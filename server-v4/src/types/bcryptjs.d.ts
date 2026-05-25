declare module 'bcryptjs' {
export function hashSync(value: string, saltRounds?: number): string;
export function hash(value: string, saltRounds?: number): Promise<string>;
export function compare(value: string, hash: string): Promise<boolean>;

  const bcrypt: {
    hashSync: typeof hashSync;
    hash: typeof hash;
    compare: typeof compare;
  };

  export default bcrypt;
}
