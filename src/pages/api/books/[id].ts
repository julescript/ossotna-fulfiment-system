import type { NextApiRequest, NextApiResponse } from 'next';
import prisma, { createTransaction } from '@/config/prisma';
import { v4 as uuid } from 'uuid';
import { compareStringToHash, hashString } from '@/utils/hashing';
import UpdateBookDTO from '@/DTOs/update-book.dto';
import { booksInclude } from '@/utils/books-include';
import { Book } from '@prisma/client';

/* /api/books/[id]
  accepts
    - PATCH request with UpdateBookDTO as body. Updates the desired book.
      NOTE: if you want to update any part of the content, send all of the content.
    - DELETE request with an optional `mode` query param ('permanent').
      Deletes the desired book (soft or permanent delete depending on your input).
    - GET request with an optional `checkPrivacy` query param ('true'):
        - if `checkPrivacy` equals to 'true', it returns an object containing a
          boolean named 'isPrivate'.
        - else:
            - if the requested book is private, send a `password` query param
              containing the saved password, or else it will return an
              unauthorized access error.
            - if the requested book is not private, it returns it.
*/
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any>
) {
  try {
    const id = req.query.id as string;

    if (req.method === 'PATCH') {
      const data = new UpdateBookDTO(req.body);

      if (data.credentials?.password) {
        data.credentials.password = await hashString(data.credentials.password);
      }

      return createTransaction(async (tx) => {
        const paragraphs: { p: string; bookContentId: string }[] = [];
        const content =
          data.content?.map((c, i) => {
            const { p, ...content } = c;
            const id = uuid();

            p.forEach((paragraph) => {
              paragraphs.push({ p: paragraph, bookContentId: id });
            });

            return { ...content, id, order: i + 1 };
          }) || [];

        if (content.length) {
          await tx.bookContent.deleteMany({ where: { bookId: id } });
        }

        const book = await tx.book.update({
          data: {
            ...data,
            credentials: { update: data.credentials },
            info: { update: data.info },
            content: { create: content },
          },
          where: { id },
        });

        if (paragraphs.length) {
          await tx.bookParagraph.createMany({ data: paragraphs });
        }

        const result = await tx.book.findUnique({
          where: { id },
          include: booksInclude,
        });

        return res.status(201).json(result);
      });
    } else if (req.method === 'DELETE') {
      let result: Book;

      if (req.query.mode === 'permanent') {
        result = await prisma.book.delete({ where: { id } });
      } else {
        result = await prisma.book.update({
          data: { isDisabled: true, disabledAt: new Date().toISOString() },
          where: { id },
        });
      }

      return res.status(201).json(result);
    } else if (req.method === 'GET') {
      if (req.query.checkPrivacy === 'true') {
        const result = await prisma.bookCredentials.findUnique({
          where: { bookId: id },
          select: { isPrivate: true },
        });

        return res.status(200).json(result);
      } else {
        const result = await prisma.book.findUnique({
          where: { id },
          include: booksInclude,
        });

        if (!result) {
          return res.status(404).json('book not found');
        }

        if (result.credentials && result.credentials.isPrivate) {
          const password = req.query.password as string;
          if (
            !password ||
            !(await compareStringToHash(password, result.credentials.password))
          ) {
            return res.status(401).json('unauthorized access');
          }
        }

        return res.status(200).json(result);
      }
    }

    return res.status(404).json('route not found');
  } catch (error: any) {
    console.log(error);
    // TODO check
    return res.status(error.status).json(error);
  }
}
