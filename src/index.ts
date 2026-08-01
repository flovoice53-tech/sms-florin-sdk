export interface Service {
  slug: string;
  name: string;
  basePriceCents: number;
  monthlyPriceCents: number | null;
}

export type RentalPeriod = "instant" | "monthly";
export type RentalStatus = "waiting" | "received" | "expired";

export interface SmsMessage {
  sender: string | null;
  body: string;
  receivedAt: string;
}

export interface Rental {
  id: number;
  status: RentalStatus;
  period: RentalPeriod;
  service: { name: string; slug: string } | null;
  phoneNumber: string | null;
  country: string | null;
  expiresAt: string;
  messages: SmsMessage[];
}

export class SmsFlorinError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "SmsFlorinError";
  }
}

export interface SmsFlorinClientOptions {
  /** Override the API base URL — only useful for local/self-hosted testing. */
  baseUrl?: string;
}

/**
 * Client for the sms-florin API (https://flo-voice1.com/api-access).
 * Rent a real phone number and receive SMS/OTP verification codes on it
 * programmatically — useful for CI, QA, or automating account creation
 * flows without exposing a personal number.
 */
export class SmsFlorinClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(apiKey: string, options: SmsFlorinClientOptions = {}) {
    if (!apiKey) throw new Error("SmsFlorinClient requires an API key");
    this.apiKey = apiKey;
    this.baseUrl = (options.baseUrl ?? "https://flo-voice1.com").replace(/\/$/, "");
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new SmsFlorinError(
        (data && typeof data === "object" && "error" in data && String(data.error)) ||
          `Request failed with status ${res.status}`,
        res.status,
      );
    }
    return data as T;
  }

  /** List available services and their prices. */
  async listServices(): Promise<Service[]> {
    const data = await this.request<{ services: Service[] }>("/api/v1/services");
    return data.services;
  }

  /** Rent a number for the given service, debiting your account balance. */
  async rentNumber(serviceSlug: string, period: RentalPeriod = "instant"): Promise<{ rentalId: number }> {
    return this.request<{ rentalId: number }>("/api/v1/rentals", {
      method: "POST",
      body: JSON.stringify({ serviceSlug, period }),
    });
  }

  /** Fetch a rental's current status, phone number, and any SMS received so far. */
  async getRental(rentalId: number): Promise<Rental> {
    return this.request<Rental>(`/api/v1/rentals/${rentalId}`);
  }

  /**
   * Poll a rental until at least one SMS arrives, or `timeoutMs` elapses.
   * Convenient for scripts/CI that need to block on the OTP showing up.
   */
  async waitForSms(
    rentalId: number,
    options: { timeoutMs?: number; intervalMs?: number } = {},
  ): Promise<SmsMessage> {
    const timeoutMs = options.timeoutMs ?? 120_000;
    const intervalMs = options.intervalMs ?? 3_000;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const rental = await this.getRental(rentalId);
      if (rental.messages.length > 0) return rental.messages[0];
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new Error(`No SMS received for rental ${rentalId} within ${timeoutMs}ms`);
  }
}
