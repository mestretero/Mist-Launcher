declare module "iyzipay" {
  class Iyzipay {
    constructor(config: { apiKey: string; secretKey: string; uri: string });
    installmentInfo: {
      retrieve: (request: any, callback: (err: any, result: any) => void) => void;
    };
    threedsInitialize: {
      create: (request: any, callback: (err: any, result: any) => void) => void;
    };
    threedsPayment: {
      create: (request: any, callback: (err: any, result: any) => void) => void;
    };
  }
  export = Iyzipay;
}
