Basics
===================

In this chapter we cover the basics of using CARE for *your* research without the need for modifying the codebase
of the project. CARE gets you started quick and allows for very flexible data collection and extrinsic model
evaluation scenarios.

Hosting CARE for Your Study
---------------------------
To host CARE with all features including coupling of NLP models, you need to start the actual CARE server, the
NLP Broker and any models you want to provide. You may run all of these components on different machines, but we
recommend to run broker and CARE server on the same machine to reduce latency.

Please check out the details of hosting the CARE server described in the
:doc:`getting started chapter <../getting_started/installation>`.

.. note::

    For running internal pilot studies, running an NGINX server along with CARE is not strictly necessary, but this is highly recommended
    when opening the tool to a network, adn especially when making it accessible to the internet. Please also configure
    your firewall to ensure high levels of security (opening only essential ports etc.). Also, you should urgently change the
    password of the admin user in the ``.env.main`` file.

Please refer to the documentation of the `NLP Broker <https://github.com/UKPLab/CARE_broker>`_ for the details on hosting
it. To test your setup, you may couple `example huggingface model nodes <https://github.com/UKPLab/CARE_models>`_
considering their accompanying documentation.

After a successful setup of the CARE server, the broker and, for instance, the sentiment classification model, you
should be able to access CARE via a browser (by default on ``http://localhost:9090``), login as a guest, access the
showcase document and make annotations. If your setup process was successful, you should see a smiley next to the
comment (indicating the sentiment according to the model), see a request logged in the NLP broker console and in
the sentiment classifier model node (with the respective comment text).

Trouble Shooting
-----------------

**Unclear errors**
Hosting CARE has been extensively tested for Ubuntu and Linux distributions, if you are hosting it on Windows or iOS,
not all automatic build processes may work. In that case, please submit an official issue in the github repository
of CARE describing the encountered issue and system configuration in detail. If you are unsure about an error while
hosting on Windows or iOS, a quickfix is to move the tool to a (virtual) Linux machine.

**Running, but no NLP results**
If CARE, broker and model are running, but you don't get any NLP results, chances are high that you did not configure
your environment variables correctly. Make sure that you chose the right URL for your local NLP broker both in the
CARE server configuration, the NLPBroker configuration and the NLP model nodes. Also make sure that you activated the
use of NLP and deactivated fallback services in the environment file.


Research with CARE
-------------------

You can realize a diverse set of studies within vanilla CARE. Generally, there are three options for the usage of the tool for
research:

    * observing text interaction and collaboration "in the wild"
    * running structured annotation studies for information labeling on PDF documents
    * testing NLP models and human-in-the-loop scenarios

CARE for Natural Text Interactions
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
If you are interested in the first case, i.e. collecting any annotation data that users generate while naturally using
CARE for reading, please check out your options for :doc:`data export <./exporting>`.
In this case, you should possess full admin rights for the instance of your tool, because behavioral data is kept under
a tight lid and is only available to administrators.

CARE for Structured Annotation Studies
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
If you are interested in running structured annotation studies, you can use the rich study management feature integrated
in CARE. The general workflow for setting up such a study looks as follows:

    1. Define the terms for your user study in the ``terms.html`` at the top directory.
    2. Ask your users to register (either anonymously or with full information); if you want to collect behavioral data
       they need to confirm the collection of this data upon registration.
    3. For each document in the study, upload it to the server via the Documents view of the dashboard.
    4. Create a study for each of the documents (either via the Documents view or via the Study view of the dashboard).
    5. Send the respective participants the study invite links for the documents they should handle.
    6. Wait for the results. You can review the progress and output of participants from the Study view of the dashboard.
    7. Either download the annotations for all your documents in the Documents view or check each document and download
       them individually. This includes all annotations of all studies, which can be disentangled by considering the
       studyId associated with each inline commentary.

.. note::
    In the future an extensive in-tool tutorial will be provided to facilitate the usage of CARE for researchers.

CARE for NLP Model Integration
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

For testing NLP models and human-in-the-loop scenarios, please consider the existing NLP model examples integrated in
care (highlight summarization and comment sentiment classification) and the extensive guide on
:doc:`modifying the frontend <../for_developers/frontend/frontend>` to add other models with different UI elements.

As an administrator you can monitor the available NLP models from within the frontend under the "NLP Skills" component
of the dashboard.

.. note::
    An easy-to-use plugin feature for the frontend is currently under development to make modifying the frontend
    for integrating new UI elements for an NLP model as easy as writing a simply configuration file.