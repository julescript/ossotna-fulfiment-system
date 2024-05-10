import * as bcrypt from 'bcryptjs';

export const hashString = async (string: string): Promise<string> => {
  const salt = await bcrypt.genSalt();
  return await bcrypt.hash(string, salt);
};

export const compareStringToHash = async (
  string: string,
  hash: string
): Promise<boolean> => await bcrypt.compare(string, hash);
