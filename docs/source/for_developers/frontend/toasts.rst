Toast Messages
==============

To provide users feedback to their actions, consider using the `toast messaging <https://bootstrap-vue.org/docs/components/toast>`_
functionality integrated in CARE. A toast message is a simple message prompted in the viewport of the user without
obstructing their view and workflow.

Toasting in the Frontend
------------------------

To create such a prompt from anywhere in the application, you simply put a ``toast`` message on the eventbus of the
application:

.. code-block:: javascript

    this.eventBus.emit('toast', {title: "title", message: "Message", variant: "warning", delay: 3000});

This produces a toast with the title 'title' and showing the short message 'Message' for 3000ms before disappearing
again. By providing the ``variant`` attribute as either of the `boostrap badge color <https://getbootstrap.com/docs/5.0/components/badge/#pill-badges>`_
keywords, you can define the color of the prompt. For consistency, you should use the badge types consistently to their
semantics; e.g. use the "danger" keyword for errors.

Toasting from the Backend
--------------------------
In case you want to provide direct feedback from the backend to the user, e.g. in case of a server error upon a given
request, you can also use the ``Socket`` class' ``sendToast`` method:

.. code-block:: javascript

    this.sendToast("Error Title", e.message, "danger");

