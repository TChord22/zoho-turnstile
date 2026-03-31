# zoho-turnstile

Drop-in Cloudflare Turnstile spam protection for Zoho Form HTML exports.

```html
<script src="https://unpkg.com/zoho-turnstile/zoho-turnstile.js"></script>
<script>
  ZohoTurnstile.init({ siteKey: 'YOUR_SITE_KEY' });
</script>
```

## Install

**CDN (recommended)**
```html
<script src="https://unpkg.com/zoho-turnstile/zoho-turnstile.js"></script>
```

**npm**
```bash
npm install zoho-turnstile
```

## Documentation

Full setup guide, options reference, Worker deployment and troubleshooting:  
👉 [dev.to/miaie/zoho-turnstile](https://dev.to/miaie/zoho-turnstile)

## Quick start

Add to your Zoho form export's `index.html`:

```html
<head>
  <link href="css/form.css" rel="stylesheet">
  <script src="js/validation.js"></script>
  <script src="https://unpkg.com/zoho-turnstile/zoho-turnstile.js"></script>
</head>

<!-- your Zoho form HTML -->

<script>
  var zf_MandArray = [...];
  var zf_FieldArray = [...];
  var isSalesIQIntegrationEnabled = false;
  var salesIQFieldsArray = [];

  ZohoTurnstile.init({
    siteKey: 'YOUR_SITE_KEY'
  });
</script>
```

## Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `siteKey` | string | ✅ | — | Cloudflare Turnstile Site Key |
| `verifyUrl` | string | — | `null` | Cloudflare Worker URL for server-side verification |
| `theme` | string | — | `'light'` | `'light'` \| `'dark'` \| `'auto'` |
| `size` | string | — | `'normal'` | `'normal'` \| `'compact'` |
| `errorMessage` | string | — | `'Please complete the security check...'` | Blocked submission message |
| `containerId` | string | — | `null` | Custom element ID to render widget into |
| `onSuccess` | function | — | `null` | Fired when token is issued |
| `onError` | function | — | `null` | Fired on Turnstile error |
| `onExpire` | function | — | `null` | Fired when token expires |

## Methods

```js
ZohoTurnstile.init(options)   // initialise
ZohoTurnstile.reset()         // reset the widget
ZohoTurnstile.getToken()      // get current token string
```

## Modes

**Client-only** — blocks submissions with no token. No backend required.

```js
ZohoTurnstile.init({ siteKey: 'YOUR_SITE_KEY' });
```

**Full verification** — verifies token server-side via a Cloudflare Worker before forwarding to Zoho.

```js
ZohoTurnstile.init({
  siteKey:   'YOUR_SITE_KEY',
  verifyUrl: 'https://your-worker.workers.dev'
});
```

See the [full documentation](https://dev.to/miaie/zoho-turnstile) for Worker setup instructions.

## Testing

Use Cloudflare's official test keys during development:

| Behaviour | Site Key |
|-----------|----------|
| Always passes | `1x00000000000000000000AA` |
| Always blocks | `2x00000000000000000000AB` |
| Forces interactive challenge | `3x00000000000000000000FF` |

## License

MIT © [SillyCoder]