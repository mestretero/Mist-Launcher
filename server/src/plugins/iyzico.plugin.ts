import Iyzipay from "iyzipay";

const iyzipay = new Iyzipay({
  apiKey: process.env.IYZICO_API_KEY || "sandbox-api-key",
  secretKey: process.env.IYZICO_SECRET_KEY || "sandbox-secret-key",
  uri: process.env.IYZICO_BASE_URL || "https://sandbox-api.iyzipay.com",
});

export function getInstallmentInfo(binNumber: string, price: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const request = { locale: "tr", binNumber, price };
    iyzipay.installmentInfo.retrieve(request, (err: any, result: any) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

export function createPayment(paymentRequest: any): Promise<any> {
  return new Promise((resolve, reject) => {
    iyzipay.threedsInitialize.create(paymentRequest, (err: any, result: any) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

export function handleCallback(token: string): Promise<any> {
  return new Promise((resolve, reject) => {
    iyzipay.threedsPayment.create({ locale: "tr", paymentId: token }, (err: any, result: any) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}
