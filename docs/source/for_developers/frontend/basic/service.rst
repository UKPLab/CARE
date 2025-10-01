NLPService
----------

The NLPService component is a wrapper around the NLP service. It offers a simple way to easily use the NLP services.

Example usage:

.. code-block:: html

    <NLPService
        :data="data"
        skill="<skillName>"
        icon-name="file-text"
        title="<Title>"
        type="button"
        @response="response"
    />

.. code-block:: javascript

    import NLPService from "@/basic/NLPService.vue";

    export default {
        components: {
            NLPService
        },
        data() {
            return {
                data: {
                    "text": "Hello world",
                    "params": {}
                }
            }
        },
        methods: {
            response(response) {
                console.log("NLP Service response", response);
            }
        }
    }