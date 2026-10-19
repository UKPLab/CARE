import { RuleTester } from 'eslint'
import vueParser from 'vue-eslint-parser'
import preferBasicComponents from './prefer-basic-components.js'
import dashboardListPage from './dashboard-list-page.js'
import dashboardRowButtons from './dashboard-row-buttons.js'
import footerButtonGroup from './footer-button-group.js'

const tester = new RuleTester({
    languageOptions: { parser: vueParser, ecmaVersion: 'latest', sourceType: 'module' },
})

tester.run('prefer-basic-components', preferBasicComponents, {
    valid: [
        '<template><BasicIcon icon-name="folder" /><BasicLoading /><BasicTable /><BasicModal /></template>',
        '<template><i>text</i><div class="modal-body" /><IconAsset name="logo" /></template>',
    ],
    invalid: [
        { code: '<template><i class="bi bi-folder" /></template>', errors: [{ messageId: 'icon' }] },
        { code: '<template><span class="spinner-border spinner-border-sm" /></template>', errors: [{ messageId: 'loading' }] },
        { code: '<template><div class="spinner-grow" /></template>', errors: [{ messageId: 'loading' }] },
        { code: '<template><table /></template>', errors: [{ messageId: 'table' }] },
        { code: '<template><b-table /></template>', errors: [{ messageId: 'table' }] },
        { code: '<template><BModal /></template>', errors: [{ messageId: 'modal' }] },
        { code: '<template><div class="modal fade" /></template>', errors: [{ messageId: 'modal' }] },
    ],
})

const imports = '<script>import Panel from "@/basic/dashboard/card/Card.vue"; import Grid from "@/basic/Table.vue";</script>'
tester.run('dashboard-list-page', dashboardListPage, {
    valid: [
        `${imports}<template><DashboardListPage /><Grid /></template>`,
        `${imports}<template><Panel><OtherTable /></Panel></template>`,
        `${imports}<template><Panel><Grid @pagination-update="paginationUpdate" /></Panel></template>`,
        `${imports}<template><Panel><Grid @paginationUpdate="paginationUpdate" /></Panel></template>`,
        `${imports}<template><Panel><Grid v-model="selectedUsers" /></Panel></template>`,
        `${imports}<template><Panel><Grid :model-value="selectedUsers" @update:model-value="selectUsers" /></Panel></template>`,
        `${imports}<template><Panel><Grid @update:modelValue="selectUsers" /></Panel></template>`,
        `${imports}<template><Panel><Grid :count="total" /></Panel></template>`,
        `${imports}<template><Panel><Grid count="10" /></Panel></template>`,
        `${imports}<template><Panel><Grid v-bind="tableProps" /></Panel></template>`,
        `${imports}<template><Panel><Grid v-on="tableEvents" /></Panel></template>`,
        `${imports}<template><Panel><Grid :[prop]="value" /></Panel></template>`,
        `${imports}<template><Panel><Grid @[event]="handler" /></Panel></template>`,
        `${imports}<script setup>import Dialog from "@/basic/Modal.vue";</script><template><Panel><Dialog><Grid /></Dialog></Panel></template>`,
    ],
    invalid: [
        { code: `${imports}<template><Panel><template #body><Grid /></template></Panel></template>`, errors: [{ messageId: 'listPage' }] },
        { code: `${imports}<template><Panel><Grid :columns="columns" :data="rows" :options="options" :buttons="buttons" @action="action" /></Panel></template>`, errors: [{ messageId: 'listPage' }] },
        { code: `${imports}<template><Panel><Grid v-model="selectedUsers" /><Grid /></Panel></template>`, errors: [{ messageId: 'listPage' }] },
        { code: `${imports}<template><panel><div><grid /></div></panel></template>`, errors: [{ messageId: 'listPage' }] },
    ],
})

tester.run('dashboard-row-buttons', dashboardRowButtons, {
    valid: [
        '<script>import { dashboardRowAction as row } from "@/basic/dashboard/actions.js"; const buttons = [row("edit", {action: "rename", icon: "pencil"})];</script>',
        '<script>import { dashboardRowButton } from "@/basic/dashboard/actions.js"; const buttons = [dashboardRowButton("shuffle", {action: "models", icon: "shuffle"})];</script>',
        '<script>const newD = {}; newD.select = {action: "select", icon: "star"};</script>',
        '<script>const newD = {}; newD["select"] = {action: "select", icon: "star"};</script>',
        '<script>const rows = data.map(d => { const newD = {...d}; newD.select = {action: "select", icon: "star"}; return newD; });</script>',
        '<script>const columns = [{name: "Name", key: "name"}]; const filter = {action: "edit"};</script>',
        '<script>const action = "title"; const column = {[action]: "edit", icon: "pencil"};</script>',
    ],
    invalid: [
        { code: '<script>const buttons = [{action: "edit", icon: "pencil"}];</script>', errors: [{ messageId: 'helper' }] },
        { code: '<script>const row = {}; row.buttons = [{action: "edit", icon: "pencil"}];</script>', errors: [{ messageId: 'helper' }] },
        { code: '<script>const row = {}; row["buttons"] = [{action: "edit", icon: "pencil"}];</script>', errors: [{ messageId: 'helper' }] },
        { code: '<script>export default {computed: {buttons() {return [{action: "edit", icon: "pencil"}];}}};</script>', errors: [{ messageId: 'helper' }] },
        { code: '<script>const buttons = [{action: "custom", icon: "shuffle"}];</script>', errors: [{ messageId: 'helper' }] },
        { code: '<script>function dashboardRowAction() {} const buttons = [dashboardRowAction("edit", {action: "edit", icon: "pencil"})];</script>', errors: [{ messageId: 'helper' }] },
    ],
})

tester.run('footer-button-group', footerButtonGroup, {
    valid: [
        '<template><BasicModal><template #footer><div class="btn-group"><span><BasicButton /></span><basic-button /></div></template></BasicModal></template>',
        '<template><BasicModal><template #body><BasicButton /><BasicButton /></template></BasicModal></template>',
        '<template><Card><template #footer><BasicButton /><BasicButton /></template></Card></template>',
        '<template><BasicModal><template #footer><slot /></template></BasicModal></template>',
    ],
    invalid: [
        { code: '<template><BasicModal><template #footer><div><BasicButton /></div><span><BasicButton /></span></template></BasicModal></template>', errors: [{ messageId: 'missingGroup' }, { messageId: 'missingGroup' }] },
        { code: '<template><BasicModal><template #footer><BasicButton /></template></BasicModal></template>', errors: [{ messageId: 'missingGroup' }] },
        { code: '<template><BasicCoordinator><template #success-footer><basic-button /></template></BasicCoordinator></template>', errors: [{ messageId: 'missingGroup' }] },
        { code: '<script>import Dialog from "@/basic/Modal.vue"; import Action from "@/basic/Button.vue";</script><template><Dialog><template #footer><Action /></template></Dialog></template>', errors: [{ messageId: 'missingGroup' }] },
    ],
})
