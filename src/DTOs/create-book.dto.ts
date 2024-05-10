import {
  BookContent,
  BookCredentials,
  BookInfo,
  BookParagraph,
} from '@prisma/client';

export type CreateBookCredentials = Omit<
  BookCredentials,
  'bookId' | 'createdAt' | 'updatedAt'
>;

export type CreateBookInfo = Omit<
  BookInfo,
  'bookId' | 'createdAt' | 'updatedAt'
>;

export type CreateBookContent = Omit<
  BookContent,
  'id' | 'bookId' | 'p' | 'order' | 'createdAt' | 'updatedAt'
> & {
  p: string[];
};

export default class CreateBookDTO {
  id: string;
  credentials: CreateBookCredentials;
  info: CreateBookInfo;
  content: CreateBookContent[];

  constructor(props: CreateBookDTO) {
    this.id = props.id;
    this.credentials = props.credentials;
    this.info = props.info;
    this.content = props.content;
  }
}
