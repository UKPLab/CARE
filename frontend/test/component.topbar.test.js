// TopBar.vue
// Details on testing-library: https://testing-library.com/docs/vue-testing-library/api/
import {render, fireEvent} from '@testing-library/vue'

import TopBar from '../src/components/dashboard/annotater/topbar/TopBar.vue'
import store from '../src/store/index.js'

describe('dashboard.annotator.topbar.TopBar Test Download Annotations', () => {
    it('TopBar Download Button', async () => {
        const props = {
            document_id: "test",
            review_id: "test",
            readonly: false,
            approve: false,
            review: true
        };

        //check download button exists
        let {findByText, getByText, container} = render(TopBar, {
            props: props,
            global: {
                plugins: [store]
            }
        });

        const downloadButton = await findByText("Download Annotations");
        expect(downloadButton).not.toBeNull();

        //TODO fails due to "open is not afunction", which is caused by the "window.saveAs()" call
        //const res = await fireEvent.click(downloadButton);
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