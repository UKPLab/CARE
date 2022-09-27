// DocumentManager.vue
// Details on testing-library: https://testing-library.com/docs/vue-testing-library/api/
import {render, fireEvent} from '@testing-library/vue'

import DocumentManager from '../src/components/dashboard/documents/DocumentManager.vue'
import store from '../src/store/index.js'

describe('dashboard.annotator.topbar.TopBar Test Download Annotations', () => {
    test.skip('TopBar Download Button', async () => {
        const props = {
            admin: false
        };

        //TODO fails due to missing socket coupling -- need to double check here
        let {findByText} = render(DocumentManager, {
            props: props,
            global: {
                plugins: [store]
            }
        });

        const downloadButton = await findByText("Export Annotations");
        expect(downloadButton).not.toBeNull();

        const res = await fireEvent.click(downloadButton);
    })
})


/*
import { withSetup } from './test-utils'
import { useFoo } from './foo'

test('useFoo', () => {
  const [result, app] = withSetup(() => useFoo(123))
  // mock provide for testing injections
  app.provide(...)
  // run assertions
  expect(result.foo.value).toBe(1)
  // trigger onUnmounted hook if needed
  app.unmount()
})*/