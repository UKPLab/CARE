import {render} from '@testing-library/vue'
import Loader from './Loader.vue'

describe('Test Loader', () => {
    it('Loader is displayed with custom text?', () => {
        const {queryAllByText} = render(Loader, {
            props: {
                text: 'This is a test...',
                loading: true
            }
        })

        expect(queryAllByText("This is a test...")).toHaveLength(2);

    })

    it('Loader is not displayed when loading var is false', () => {
        const {queryAllByText} = render(Loader, {
            props: {
                text: 'This is a test...',
                loading: false
            }
        })

        expect(queryAllByText("This is a test...")).toHaveLength(0);

    })
})