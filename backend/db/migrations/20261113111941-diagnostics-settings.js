'use strict';
// Keep migration values self-contained so future default changes do not alter history.
const values = {queryTimeoutMs:2000,autoRefreshSeconds:30,connectionWarningPct:80,connectionCriticalPct:95,
  queryWarningSeconds:30,queryCriticalSeconds:120,cacheWarningPct:95,cacheCriticalPct:90,
  rollbackWarningPct:5,rollbackCriticalPct:20,wraparoundWarningAge:150000000,wraparoundCriticalAge:180000000};
module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('setting',Object.entries(values).map(([key,value])=>({
      key:'diagnostics.'+key,value:String(value),type:'number',onlyAdmin:true,allowUserOverride:false,
      displayName:key,displayGroup:'Diagnostics',description:'Database diagnostics '+key,
      createdAt:new Date(),updatedAt:new Date()
    })));
  },
  async down(queryInterface) {
    await queryInterface.bulkDelete('setting',{key:Object.keys(values).map(key=>'diagnostics.'+key)});
  }
};
