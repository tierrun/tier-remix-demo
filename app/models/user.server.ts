import type { Password, User } from "@prisma/client";
import bcrypt from "bcryptjs";

import { prisma } from "~/db.server";
import type { PlanName } from "~/models/tier.server";
import tier, { isTierError } from "~/models/tier.server";

export type { User } from "@prisma/client";

const checking = new Map<User["id"], Promise<void>>();
export async function freePlanDefault(id: User["id"]) {
  const inflight = checking.get(id);
  if (inflight) return inflight;
  const check = subscribeIfNotSubscribed(id).then(() => {
    checking.delete(id);
  });
  checking.set(id, check);
  return check;
}

async function subscribeIfNotSubscribed(id: User["id"]) {
  try {
    await tier.lookupPhase(`org:${id}`);
    return;
  } catch (er) {
    if (isTierError(er) && er.code === "org_not_found") {
      const { plans } = await tier.pullLatest();
      for (const plan of Object.keys(plans)) {
        if (plan.startsWith("plan:free@")) {
          await tier.subscribe(`org:${id}`, plan as PlanName);
          return;
        }
      }
    }
    throw er;
  }
}

export async function getUserById(id: User["id"]) {
  const user = await prisma.user.findUnique({ where: { id } });

  // if they're not signed up already, put them on the free plan
  if (user) {
    await freePlanDefault(user.id);
  }

  return user;
}

export async function getUserByEmail(email: User["email"]) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    await freePlanDefault(user.id);
  }
  return user;
}

export async function createUser(email: User["email"], password: string) {
  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      password: {
        create: {
          hash: hashedPassword,
        },
      },
    },
  });

  if (user) {
    await freePlanDefault(user.id);
  }

  return user;
}

export async function deleteUserByEmail(email: User["email"]) {
  const user = await getUserByEmail(email).catch(() => null);
  if (user) {
    tier.cancel(`org:${user.id}`).catch(() => {});
  }
  return prisma.user.delete({ where: { email } });
}

export async function verifyLogin(
  email: User["email"],
  password: Password["hash"]
) {
  const userWithPassword = await prisma.user.findUnique({
    where: { email },
    include: {
      password: true,
    },
  });

  if (userWithPassword) {
    await freePlanDefault(userWithPassword.id);
  }

  if (!userWithPassword || !userWithPassword.password) {
    return null;
  }

  const isValid = await bcrypt.compare(
    password,
    userWithPassword.password.hash
  );

  if (!isValid) {
    return null;
  }

  const { password: _password, ...userWithoutPassword } = userWithPassword;

  return userWithoutPassword;
}
