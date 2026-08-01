# sms-florin

Official JS/TS client for the [sms-florin](https://flo-voice1.com) API — rent a real phone number and receive SMS/OTP verification codes on it programmatically. Useful for CI, QA, or automating account-creation flows without exposing a personal number.

```bash
npm install sms-florin
```

## Usage

```ts
import { SmsFlorinClient } from "sms-florin";

const client = new SmsFlorinClient(process.env.SMS_FLORIN_API_KEY!);

const services = await client.listServices();
console.log(services); // [{ slug: "whatsapp", name: "WhatsApp", basePriceCents: 150, ... }, ...]

const { rentalId } = await client.rentNumber("whatsapp");

const rental = await client.getRental(rentalId);
console.log(rental.phoneNumber); // "+44..."

// Block until the OTP arrives (e.g. inside a CI test)
const sms = await client.waitForSms(rentalId, { timeoutMs: 120_000 });
console.log(sms.body);
```

## Getting an API key

Create an account at [flo-voice1.com](https://flo-voice1.com), then generate a key at [/api-access](https://flo-voice1.com/api-access). Balance is shared with your regular account — no separate API balance to manage.

## API reference

| Method | Description |
| --- | --- |
| `listServices()` | List available services and their prices. |
| `rentNumber(serviceSlug, period?)` | Rent a number (`"instant"` or `"monthly"`), debiting your balance. |
| `getRental(rentalId)` | Get a rental's status, phone number, and any SMS received so far. |
| `waitForSms(rentalId, options?)` | Poll until an SMS arrives or the timeout elapses. |

## License

MIT
