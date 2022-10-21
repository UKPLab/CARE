// TopBar.vue
// Details on testing-library: https://testing-library.com/docs/vue-testing-library/api/
import {render, fireEvent} from '@testing-library/vue'


describe('dashboard.annotator.topbar.TopBar Test Download Annotations', () => {
    it('Topbar Download Button', () => {
    });

    /*
    TODO does not work any more with the teleport feature -- look into that (add fake parent)

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
            },
            parent:
        });

        const downloadButton = await findByText("Download Annotations");
        expect(downloadButton).not.toBeNull();
    });

     */
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