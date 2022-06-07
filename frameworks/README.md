
## Manual Configuring 

To make these settings, the Hypothesis Server must be running! (see above). If you are not sure
whether all required services have started properly, you can use `make services`.


1. Add admin account to hypothesis server:
```
cd frameworks/hypothesis/h
tox -qe dev -- sh bin/hypothesis --dev user add --username <username> --email <email> --password <password>
tox -qe dev -- sh bin/hypothesis --dev user admin <username>
```

2. Sign in on the hypothesis server: http://localhost:5000/
3. Create oAuth client token: http://localhost:5000/admin/oauthclients/new
4. Create oAuth
```
  Name: < custom name > 
  Authority: localhost 
  Grand type: authorization_code
  Trusted: Yes
  Redirect URL: http://localhost:5000/app.html
```

5. Get Client ID and add it into the Makefile!


### Further information about the Hypothesis Framework

* Client setup manual: https://h.readthedocs.io/projects/client/en/latest/developers/developing/#setting-up-a-client-development-environment
* Server setup manual: https://h.readthedocs.io/en/latest/developing/install/#you-will-need
* Connecting Server & Client: https://h.readthedocs.io/en/latest/developing/integrating-client/
* Creating a User and Accessing the Admin Interface: https://h.readthedocs.io/en/latest/developing/administration/
* Hypothesis API:  https://h.readthedocs.io/en/latest/api-reference/v1/
* Hypothesis Server DOC: https://h.readthedocs.io/_/downloads/en/latest/pdf/
* Hypothesis Client DOC: https://h.readthedocs.io/_/downloads/client/en/latest/pdf/ 
* Server git repo: https://github.com/hypothesis/h 
* Client git repo: https://github.com/hypothesis/client