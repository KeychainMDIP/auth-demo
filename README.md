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
