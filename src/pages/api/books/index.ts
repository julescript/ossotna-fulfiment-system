import type { NextApiRequest, NextApiResponse } from 'next';
import prisma, { createTransaction } from '@/config/prisma';
import CreateBookDTO from '@/DTOs/create-book.dto';
import { v4 as uuid } from 'uuid';
import { hashString } from '@/utils/hashing';
import { booksInclude } from '@/utils/books-include';

/* /api/books
  accepts
    - POST request with CreateBookDTO as body. Creates a new book.
    - GET request with an optional `isPrivate` query param ('true' | 'false').
      It returns a list of books.
*/
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any>
) {
  try {
    if (req.method === 'POST') {
      const data = new CreateBookDTO(req.body);

      if (data.credentials.password) {
        data.credentials.password = await hashString(data.credentials.password);
      }

      return createTransaction(async (tx) => {
        const paragraphs: { p: string; bookContentId: string }[] = [];
        const content = data.content.map((c, i) => {
          const { p, ...content } = c;
          const id = uuid();

          p.forEach((paragraph) => {
            paragraphs.push({ p: paragraph, bookContentId: id });
          });

          return { ...content, id, order: i + 1 };
        });

        const book = await tx.book.create({
          data: {
            ...data,
            credentials: { create: data.credentials },
            info: { create: data.info },
            content: { create: content },
          },
        });

        if (paragraphs.length) {
          await tx.bookParagraph.createMany({ data: paragraphs });
        }

        const result = await tx.book.findUnique({
          where: { id: book.id },
          include: booksInclude,
        });

        return res.status(201).json(result);
      });
    } else if (req.method === 'GET') {
      const isPrivate = req.query.isPrivate;

      const result = await prisma.book.findMany({
        where: {
          isDisabled: false,
          credentials:
            isPrivate === 'true'
              ? { isPrivate: true }
              : isPrivate === 'false'
              ? { isPrivate: false }
              : undefined,
        },
        include: booksInclude,
      });

      return res.status(200).json(result);
    }

    return res.status(404).json('route not found');
  } catch (error: any) {
    console.log('here');
    console.log(error);
    // TODO check
    return res.status(error.status).json(error);
  }
}
