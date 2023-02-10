Loader
~~~~~~

If you need to fetch resources from the server or do computations that need more than a few milliseconds, you should
provide visual feedback to the user. The ``Loading`` component offers an easy-to-use standardized way of doing this.

Simply add it to your component template, usually within an if clause conditioned on the data to be loaded.

.. code-block:: html

    <Loading text="<loading_text>"></Loading>'

.. code-block:: javascript

    import { Loading } from '@/components/basic/Loading.vue';

    export default {
        components: {
            Loading,
        },
    };


The default text says "Loading...", but can be specified individually.
