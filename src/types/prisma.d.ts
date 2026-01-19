declare module '@prisma/client' {
  export namespace Prisma {
    class Decimal {
      constructor(value: any);
      toString(): string;
      mul(value: Decimal | string | number): Decimal;
    }
  }

  export class PrismaClient {
    constructor(...args: any[]);
    $connect(): Promise<void>;
    $disconnect(): Promise<void>;
    $use(...args: any[]): void;
    [key: string]: any;
  }
}
