# auth-demo

## Running

- git clone this repo
- cd auth-demo
- to run in docker
  - run `./start-demo`
- to run in node
  - run `./rebuildDemo`
- navigate to https://localhost:3000


## QR code integration

![login page](login.png)

The QR code encodes a URL that includes the challenge DID as a query parameter:

`https://wallet.mdip.yourself.dev?challenge=did:test:z3v8Auak6KesbV1nnMz1XUUMoZcuW4GBKygWNnKHHAQU3N9sDDz`

The wallet URL is specified in an environment variable `AD_WALLET_URL` included in a `.env` file.

The challenge is created with a callback specified in the `AD_CALLBACK_URL` environment variable. This should point to the location where the auth-demo is deployed.

See `sample.env` for example values.

An MDIP wallet installed on a mobile device can scan the QR code and extract the challenge DID from the URL, ignoring the wallet URL preceding the challenge.


The API offers two ways to submit a response to the challenge, GET and POST.

The GET method uses a query parameters for the `response`, e.g.

```
curl https://auth-demo-server:3000/api/login?response=did:test:z3v8AuaUENXcWUdHKpJqozSLyjHg8pjGF7Dd5H8GnKaeLgDuTcG
```

The POST method takes the same parameter in the body of the request:

```
curl -X POST -H "Content-Type: application/json" -d '{"response":"did:test:z3v8AuaUENXcWUdHKpJqozSLyjHg8pjGF7Dd5H8GnKaeLgDuTcG"}' https://localhost:3000/api/login
```

Both login methods return a JSON object indicating whether the login was successful:
```
{ authenticated: [ true | false ] }
```

## Authentication Sequence Diagram

The diagram below details the MDIP Authentication process of a user Alice accessing a 3rd Party Website and authenticating herself using a smart-phone wallet to scan the Challenge QR code from the Website's login page. The diagram demonstrates the 3rd Party Website operator using a hosted Node-as-a-Service MDIP gatekeeper infrastructure provider.

![MDIP_Auth_Seq](https://github.com/user-attachments/assets/064d1fbf-1d96-4284-b739-bd17e78d159b)
