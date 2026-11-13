jest.mock('../webserver/Socket',()=>class Socket {});
const DiagnosticsSocket=require('../webserver/sockets/diagnostics');
const {collectDiagnostics,statusFor,defaults,queries}=require('../db/diagnostics');
const {readOnlyQuery}=require('../db/health');
const section=data=>({available:true,data});
function fakeDatabase(fail) {
    const db={connectionManager:{pool:{size:2,max:5}},transaction:jest.fn(async(options,fn)=>fn({id:1}))};
    db.query=jest.fn(async(sql)=>{
        if(fail?.(sql)) throw new Error('private database details');
        if(sql.includes('FROM setting')) return [];
        if(sql.includes('server_version')) return [{version:'16',wraparoundAge:100}];
        if(sql.includes('AS used')) return [{used:3,max:100}];
        if(sql===queries.efficiency) return [{cacheHitPct:99,rollbackPct:0}];
        return [];
    });
    return db;
}
test('denies non-admin before any diagnostic database work',async()=>{
    const socket=Object.create(DiagnosticsSocket.prototype);
    socket.isAdmin=jest.fn().mockResolvedValue(false);
    socket.server={db:{sequelize:fakeDatabase()}};
    await expect(socket.getDiagnostics()).rejects.toMatchObject({key:'errors.users.adminAccessRequired'});
    expect(socket.server.db.sequelize.query).not.toHaveBeenCalled();
});
test('registers only the read event without an outer write transaction',()=>{
    const socket=Object.create(DiagnosticsSocket.prototype); socket.createSocket=jest.fn(); socket.init();
    expect(socket.createSocket).toHaveBeenCalledWith('diagnosticsGet',socket.getDiagnostics,{},false);
});
test('admin gets snapshot and pool stats',async()=>{
    const socket=Object.create(DiagnosticsSocket.prototype);socket.isAdmin=async()=>true;
    socket.server={db:{sequelize:fakeDatabase()}};
    const result=await socket.getDiagnostics();
    expect(result.status).toBe('ok');
    expect(result.sections.connections.data.pool).toEqual({size:2,max:5});
    expect(result.sections.migrations.data.pending).toContain('20261113111941-diagnostics-settings.js');
});
test.each([
    ['connections',{used:80,max:100},'Warning'],['connections',{used:95,max:100},'Critical'],
    ['queries',[{ageSeconds:30}],'Warning'],['queries',[{ageSeconds:120}],'Critical'],
    ['efficiency',{cacheHitPct:95},'Warning'],['efficiency',{cacheHitPct:90},'Critical'],
    ['efficiency',{rollbackPct:5},'Warning'],['efficiency',{rollbackPct:20},'Critical'],
    ['database',{wraparoundAge:150000000},'Warning'],['maintenance',[{wraparoundAge:180000000}],'Critical'],
    ['efficiency',{cacheHitPct:null,rollbackPct:null},'OK']
])('evaluates %s threshold boundaries', (name,data,expected)=>{
    expect(statusFor({[name]:section(data)})).toBe(expected);
});
test('configured thresholds affect status; Critical wins over unavailable',()=>{
    const sections={connections:section({used:50,max:100}),database:{available:false}};
    expect(statusFor(sections,{...defaults,connectionCriticalPct:50})).toBe('Critical');
    expect(statusFor({database:{available:false}})).toBe('Warning');
});
test('each failed section stays unavailable while the others load',async()=>{
    for(const failed of Object.keys(queries)) {
        const result=await collectDiagnostics(fakeDatabase(sql=>sql===queries[failed]));
        expect(result.sections[failed]).toMatchObject({available:false,reason:'unavailable'});
        expect(result.sections.server.available).toBe(true);
        expect(result.status).toBe('warning');
        expect(JSON.stringify(result)).not.toContain('private database details');
    }
});
test('read-only and bounded server-side timeouts precede every SELECT',async()=>{
    const db=fakeDatabase();
    await readOnlyQuery(db,'SELECT 1',999999);
    expect(db.transaction).toHaveBeenCalledWith({readOnly:true},expect.any(Function));
    expect(db.query.mock.calls.map(c=>c[0])).toEqual(['SET TRANSACTION READ ONLY','SET LOCAL statement_timeout = 10000','SET LOCAL lock_timeout = 10000','SELECT 1']);
    expect(new Set(db.query.mock.calls.map(c=>c[1].transaction)).size).toBe(1);
});
test('server cancellation propagates to section isolation',async()=>{
    const db=fakeDatabase(sql=>sql===queries.storage);
    const result=await collectDiagnostics(db);
    expect(result.sections.storage.available).toBe(false);
    expect(result.sections.maintenance.available).toBe(true);
    expect(result.sections.migrations.available).toBe(true);
});
test('uses configured timeout and falls back when settings fail',async()=>{
    const db=fakeDatabase(); const original=db.query.getMockImplementation();
    db.query.mockImplementation(sql=>sql.includes('FROM setting')?[{key:'diagnostics.queryTimeoutMs',value:'1234'},{key:'diagnostics.connectionCriticalPct',value:'2'}]:original(sql));
    const result=await collectDiagnostics(db);
    expect(result.thresholds.queryTimeoutMs).toBe(1234);
    expect(db.query.mock.calls.some(c=>c[0]==='SET LOCAL statement_timeout = 1234')).toBe(true);
    expect((await collectDiagnostics(fakeDatabase(sql=>sql.includes('FROM setting')))).status).toBe('warning');
});

test('query text is bounded and literals do not leak; blockers remain usable',async()=>{
    const db=fakeDatabase();const original=db.query.getMockImplementation();
    db.query.mockImplementation(sql=>sql===queries.queries?[{pid:1,ageSeconds:4,query:"SELECT 'sensitive value', 123",blockers:[2]}]:original(sql));
    const result=await collectDiagnostics(db);
    const data=result.sections.queries.data;
    expect(data.longest[0].query).not.toContain('sensitive value');
    expect(data.longest[0].query.length).toBeLessThanOrEqual(120);
    expect(data.blocking).toEqual([{blockedPid:1,blockingPid:2,waitingMs:4000}]);
});
test('every collected data statement is SELECT scoped to read-only transactions',async()=>{
    const db=fakeDatabase();await collectDiagnostics(db);
    for(const [sql,options] of db.query.mock.calls) {
        expect(sql.trim()).toMatch(/^(SELECT|SET TRANSACTION READ ONLY|SET LOCAL (statement|lock)_timeout)/);
        expect(options.transaction).toBeDefined();
    }
    expect(queries.connections).toContain('datname=current_database()');
    expect(queries.queries).toContain('datname=current_database()');
    expect(queries.efficiency).toContain('datname=current_database()');
});


test('a PostgreSQL statement timeout only disables its section',async()=>{
    const db=fakeDatabase(); const original=db.query.getMockImplementation();
    db.query.mockImplementation(sql=> {
        if(sql===queries.efficiency) return Promise.reject(Object.assign(new Error('canceling statement due to statement timeout'),{original:{code:'57014'}}));
        return original(sql);
    });
    const snapshot=await collectDiagnostics(db);
    expect(snapshot.sections.efficiency).toMatchObject({available:false,reason:'unavailable'});
    expect(snapshot.sections.storage.available).toBe(true);
    expect(snapshot.sections.migrations.available).toBe(true);
    expect(snapshot.status).toBe('warning');
});
test('database section failure does not hide storage or migration information',async()=>{
    const snapshot=await collectDiagnostics(fakeDatabase(sql=>sql.includes('server_version')));
    expect(snapshot.sections.server.available).toBe(false);
    expect(snapshot.sections.storage.available).toBe(true);
    expect(snapshot.sections.storage.data.databaseBytes).toBeNull();
    expect(snapshot.sections.migrations.available).toBe(true);
});
test('generated settings migration agrees with runtime defaults and is reversible',async()=>{
    const migration=require('../db/migrations/20261113111941-diagnostics-settings');
    const qi={bulkInsert:jest.fn(),bulkDelete:jest.fn()};
    await migration.up(qi);
    const [table,rows]=qi.bulkInsert.mock.calls[0];
    expect(table).toBe('setting');
    expect(Object.fromEntries(rows.map(r=>[r.key.replace('diagnostics.',''),Number(r.value)]))).toEqual(defaults);
    expect(rows.every(r=>r.onlyAdmin && !r.allowUserOverride)).toBe(true);
    await migration.down(qi);
    expect(qi.bulkDelete).toHaveBeenCalledWith('setting',{key:rows.map(r=>r.key)});
});
