import type { Note, User } from "@prisma/client";

import tier from "~/models/tier.server";

import { prisma } from "~/db.server";

export type { Note } from "@prisma/client";

export function getNote({
  id,
  userId,
}: Pick<Note, "id"> & {
  userId: User["id"];
}) {
  return prisma.note.findFirst({
    select: { id: true, body: true, title: true },
    where: { id, userId },
  });
}

export async function getNoteListItems({ userId }: { userId: User["id"] }) {
  return prisma.note
    .findMany({
      where: { userId },
      select: { id: true, title: true },
      orderBy: { updatedAt: "desc" },
    })
    .then((items) => {
      tier
        .report(`org:${userId}`, "feature:notes:total", items.length)
        .catch(() => {});
      return items;
    });
}

export async function createNote({
  body,
  title,
  userId,
}: Pick<Note, "body" | "title"> & {
  userId: User["id"];
}) {
  // see if we're at our limit
  const answer = await tier
    .can(`org:${userId}`, `feature:notes:total`)
  if (!answer.ok) {
    throw Object.assign(new Error("cannot create note, at plan limit"), {
      cause: {
        status: 402,
        code: "plan_limit",
      },
    });
  }

  return prisma.note.create({
    data: {
      title,
      body,
      user: {
        connect: {
          id: userId,
        },
      },
    },
  });
}

export async function deleteNote({
  id,
  userId,
}: Pick<Note, "id"> & { userId: User["id"] }) {
  const result = await prisma.note.deleteMany({
    where: { id, userId },
  });
  await getNoteListItems({ userId });
  return result;
}
