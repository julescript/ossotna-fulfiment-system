import {
  CreateBookContent,
  CreateBookCredentials,
  CreateBookInfo,
} from './create-book.dto';

export type UpdateBookCredentials = Partial<CreateBookCredentials>;

export type UpdateBookInfo = Partial<CreateBookInfo>;

export default class UpdateBookDTO {
  credentials?: UpdateBookCredentials;
  info?: UpdateBookInfo;
  content?: CreateBookContent[];

  constructor(props: UpdateBookDTO) {
    this.credentials = props.credentials;
    this.info = props.info;
    this.content = props.content;
  }
}
