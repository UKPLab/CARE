// MyComponent.test.js
import { render } from '@testing-library/vue'
import MyComponent from '../src/components/NotFoundPage.vue'

test('ErrorPage', () => {
  const { getByText } = render(MyComponent, {
    props: {
      /* ... */
    }
  })

  // assert output
  console.log(getByText('...'))
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