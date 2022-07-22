# NLP Server

## DISCLAIMER
This component is under continuous development and refactoring. Specifically, the following features are not implemented
yet, although they might be referenced in the following documentation:
* adding a gunicorn (or any WSGI server) in-front of the flask app
* structuring of the server components using:
  * Blueprints for flask routes (checkout documentation on that)
  * Celery task registry (checkout documentation on that)
  * Flower does not connect properly yet (for monitoring Celery)

## Description
This directory contains all files associated with the NLP Server, which receives, 
evaluates and answers all requests related to NLP.


## Server Infrastructure
### Technologies
The NLP server uses Flask, SocketIO and Celery to manage requests via web sockets. RabbitMQ is used as a message broker,
Redis as a persistent result backend and for session management, Flower for Celery surveilance. Additionally, the
official GROBID server runs to process PDFs.

### Monitoring Services
The RabbitMQ status monitor and Flower for surveilance of celery workers are used. To check-in on the RabbitMQ instance 
you should visit in your browser:
```
localhost:15672
```
You can access the server via providing username and password. Per default these are both `guest`.

The Flower monitor is accessible at port 8888. To check-in on the Celery tasks visit in your browser:
(currently, there are connection problems -- so no proper updates to jobs show)
```
localhost:8888
```

### Process Architecture
The following figure outlines the architecture of the NLP server, where a request is passed to a flask instance, which 
establishes a socketio connection. Upon request a celery worker is requestes via the celery client and broker. The 
pool worker then performs the task while optionally sending messages via socketio (and indirectly the message queue) to
the client. The result is written to the redis backend and can be grabbed from there.

![Overview](docs/tech.png?raw=true "Process Architecture")

Note that the celery worker has no application context (of the flask app) and all necessary parameters have to be passed
by value or read from disk/backend. This should inform the design of the task architecture

### Dataflow 
The following figure makes the data and call flow explicit. The flask app spans a celery process via the broker interface
to the worker. The worker performs the task and the result can be read from the flask app (or the celery workers).

![Overview](docs/flow.png?raw=true "Process Architecture")

## Adding Components
Warning: This is WIP and will be specified in more detail later. This is the first proposal to approach the issue.

### Data and Task Model
Any task that requires computing or IO waiting time should be realized within a celery worker and hence specified as
a celery task. These tasks are decorated methods that can be specified under the celery task path (TODO!).

To manage the connection the flask app maintains a session. The session management should be realized within the flask
app. This includes keeping track of results, running celery tasks etc. The session object contains all relevant data
or pointers to the result backend to perform tasks. As of now, we do not provide any particular endpoint via flask, but
authentication would need to be required through a flask end-point (not supported by WS). This should be realized via
so-called blueprints.

To have an easy to manage web socket you can use Namespaces. After registering them (one should be enough) on the 
socketio server, requests on the specified path will be forwarded to the respective class. The class can import 
the session object and socketio convenience methods as usually. The session management should evolve around this 
Namespace class.

### Life Cycle
Generally speaking the NLP server receives a sequence of inputs -- a document, annotations, etc. -- as well as the
hyper-parameters for performing some task -- like model type, expected output type, task type etc. -- and upon 
request performs the task. After the request there are status updates (if necessary) and finally a result is 
pushed via the websocket to the client. The connection remains open to get new partial inputs and re-run the task or
to provide the results again. After some time the connection is closed and the session discarded.

### Server Components
There is a session manager running on the flask app. It is responsible for managing inputs in the session and providing
the required information to submodules. There is a module responsible for cleaning celery tasks and results. There is a
moduler responsible for managing inputs and one for results. There is a module managing NLP models.

### Websocket
Test: `curl "http://localhost:6000/socket.io/?EIO=4&transport=polling"`

## Interface

The nlp server is based on socket.io offering a message interface. The following list of message types is kept up-to-date
and should be exhaustive. For each message type the response type (if existent) and the dataformat are outlined.

Generally, the pattern of the provided message channels are:
  * `req_`<message-type>   = requesting something from the server
  * `res_`<message-type>   = if there is a response, the response for a previous request

The parameters are always passed as jsons. They may point to objects in the database which the NLP server needs
to load from.

### tag_annotation(annotation)
|     | name               | data            | description                                             | 
|-----|--------------------|-----------------|---------------------------------------------------------|
| req | req_tag_annotation | annotation.json | Sends and annotation incl. text and anchors to process. | 
| res | res_tag_annotation | tags.json       | Responds with the model generated tags                  | 


### generate_report(document_id, user_id)
|     | name                | data            | description                                             | 
|-----|---------------------|-----------------|---------------------------------------------------------|
| req | req_generate_report | annotation.json | Sends and annotation incl. text and anchors to process. | 
| res | res_generate_report | tags.json       | Responds with the model generated tags                  | 

