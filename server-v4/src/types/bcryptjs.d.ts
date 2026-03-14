declare module 'bcryptjs' {
  export function hashSync(value: string, saltRounds?: number): string;
  export function compare(value: string, hash: string): Promise<boolean>;

  const bcrypt: {
    hashSync: typeof hashSync;
    compare: typeof compare;
  };

  export default bcrypt;
}
