# auth-demo

## QR code integration

![login page](login.png)

The QR code encodes JSON containing the challenge DID and the callback URL, e.g.

```
{
    "challenge": "did:test:z3v8Auabug8T9e2WtqHhVrfCwQ5u2JvaHFprgYumKpXpQfk9nEs",
    "callbackURL": "https://localhost:3000/api/login"
}
```

The API offers two ways to submit a response to the challenge, GET and POST.

The GET method uses query parameters `response` and `challenge`, e.g.

```
curl https://localhost:3000/api/login?response=did:test:z3v8AuaUENXcWUdHKpJqozSLyjHg8pjGF7Dd5H8GnKaeLgDuTcG&challenge=did:test:z3v8Auabug8T9e2WtqHhVrfCwQ5u2JvaHFprgYumKpXpQfk9nEs
```

The POST method takes the same parameters in the body of the request:

```
curl -X POST -H "Content-Type: application/json" -d '{"response":"did:test:z3v8AuaUENXcWUdHKpJqozSLyjHg8pjGF7Dd5H8GnKaeLgDuTcG","challenge":"did:test:z3v8Auabug8T9e2WtqHhVrfCwQ5u2JvaHFprgYumKpXpQfk9nEs"}' https://localhost:3000/api/login
```
## Authentication Sequence Diagram

The diagram below details the MDIP Authentication process of a user Alice accessing a 3rd Party Website and authenticating herself using a smart-phone wallet to scan the Challenge QR code from the Website's login page. The diagram demonstrates the 3rd Party Website operator using a hosted Node-as-a-Service MDIP gatekeeper infrastructure provider.

![MDIP_Auth_Seq](https://github.com/user-attachments/assets/064d1fbf-1d96-4284-b739-bd17e78d159b)
