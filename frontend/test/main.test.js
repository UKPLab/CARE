// MyComponent.test.js
import {render} from '@testing-library/vue'
import MyComponent from '../src/components/NotFoundPage.vue'

describe('Main Tests', () => {
    it('ErrorPage', async () => {
        const {findByText} = render(MyComponent, {
            props: {
                /* ... */
            }
        })

        const component = await findByText("You are wrong, this page doesn't exists!")
        expect(component).not.toBeNull();

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