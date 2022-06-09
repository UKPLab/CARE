# Frontend

## Overview
The frontend is realized entirely in Vue.js. Each component has a well-defined
functionality and responsibility and the app is structured into these 
components. To manage data, we use vuex. 

## Code Structure
```
> src                               # required structure by vue; all code
>>> assets                          # static resources like images 

>>> components                      # the vue components of the app
>>>>> auth                          # components related to authentication
>>>>> dashboard                     # components related to the user dashboard
>>>>> Dashboard.vue                 # central component bundling user-related components
>>>>> NotFoundPage.vue              # the default not found page

>>> store                           # the vuex store definitions
>>>>> modules                       # sub-modules of the store
>>>>>>> auth.js                     # providing authentication 
>>>>>>> user.js                     # providing user information
>>>>>>> websocket.js                # providing websocket interface
>>>>> index.js                      # bundles module

>>> App.vue                         # the central vue app

>>> main.js                         # boostraps the frontend incl. store + sockets

>>> routes.js                       # defines front-end routing for components
```