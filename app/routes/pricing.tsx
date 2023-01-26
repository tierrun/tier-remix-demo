import type { ActionArgs, LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { requireUserId } from "~/session.server";

import { Form, Link, useActionData, useLoaderData } from "@remix-run/react";
import type { FC } from "react";
import type {
  FeatureName,
  Features,
  Model,
  OrgName,
  Phase,
  Plan,
  PlanName,
} from "~/models/tier.server";
import tier from "~/models/tier.server";
import { getUserId } from "~/session.server";
import { useOptionalUser } from "~/utils";

interface LoaderData {
  model: Model;
  modelFeatures: { [f: FeatureName]: string };
  org?: OrgName;
  plans?: PlanName[];
  features?: Features[];
}

// sort our plans into the order we want
const order = ["plan:free@", "plan:basic@", "plan:pro@", "plan:paygo@"];
const planNameSort = (a: string, b: string): 0 | 1 | -1 => {
  for (const o of order) {
    if (a.startsWith(o)) return -1;
    if (b.startsWith(o)) return 1;
  }
  return 0;
};

export async function action({ request }: ActionArgs) {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const plan = formData.get("plan");
  if (typeof plan !== "string") {
    json({ error: "plan is required" }, { status: 400 });
  }
  await tier.subscribe(`org:${userId}`, plan as Features);
  return json({ plans: [plan] });
}

export async function loader({ request }: LoaderArgs) {
  // just show the latest and greatest version of each plan
  const model: Model = await tier.pullLatest();
  const userId = await getUserId(request);
  // try to get their current plan
  const org: OrgName | undefined = userId
    ? (`org:${userId}` as OrgName)
    : undefined;
  const loaderData: LoaderData = {
    org,
    model: {
      plans: Object.fromEntries(
        Object.entries(model.plans).sort(([a], [b]) => planNameSort(a, b))
      ) as Model["plans"],
    },
    modelFeatures: {},
  };
  for (const plan of Object.values(model.plans) as Plan[]) {
    if (plan.features) {
      for (const f of Object.keys(plan.features) as FeatureName[]) {
        if (!loaderData.modelFeatures[f]) {
          loaderData.modelFeatures[f] = plan.features[f].title || f;
        }
      }
    }
  }
  if (org) {
    try {
      const phase: Phase = await tier.lookupPhase(org);
      loaderData.plans = phase.plans || [];
      loaderData.features = phase.features;
    } catch (er) {}
  }
  return json<LoaderData>(loaderData);
}

const fmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 12,
  minimumFractionDigits: 2,
});

const Card: FC<{
  name: PlanName;
  plan: Plan;
  currentPlan?: PlanName | undefined;
}> = ({ name, plan, currentPlan }) => {
  const totalTiers =
    plan.features?.["feature:notes:total" as FeatureName]?.tiers;
  const topTotalTier = totalTiers?.[totalTiers?.length - 1];

  // not a real plan
  if (!totalTiers || !topTotalTier) {
    return <></>;
  }
  const secondTopTier = totalTiers[totalTiers.length - 2];

  const topLinePrice =
    !topTotalTier.base && !topTotalTier.price
      ? "Free"
      : fmt.format(
          ((!topTotalTier.base && secondTopTier?.base
            ? secondTopTier.base
            : !topTotalTier.base && !secondTopTier.base
            ? topTotalTier.price
            : topTotalTier.base) as number) / 100
        );
  const topLineSub =
    totalTiers.length === 1
      ? `Up to ${topTotalTier.upto} notes`
      : !topTotalTier.base && secondTopTier.base
      ? `Up to ${secondTopTier.upto} notes, then ${fmt.format(
          (topTotalTier.price || 0) / 100
        )} per note`
      : topTotalTier.price && !topTotalTier.base
      ? `Per note, after free quota`
      : topTotalTier.upto
      ? `Up to ${topTotalTier.upto} notes, after free quota`
      : "";

  const editsTiers = plan.features?.["feature:notes:edit"]?.tiers;
  const firstEditsTier = editsTiers?.[0];
  const topEditsTier = editsTiers?.[editsTiers?.length - 1];
  if (!editsTiers || !firstEditsTier || !topEditsTier) {
    return <></>;
  }

  return (
    <>
      <div className="relative rounded-lg border-t-4 border-green-400 bg-white p-5 pb-20 shadow">
        <p className="text-sm font-medium uppercase text-gray-500">
          {plan.title}
        </p>

        <p className="mt-4 text-3xl font-medium text-gray-700">
          {topLinePrice}
        </p>

        <p className="mt-4 h-8 font-medium text-gray-700">{topLineSub}</p>

        <div className="mt-6">
          <ul className="grid grid-cols-1 gap-4">
            {topTotalTier.upto ? (
              <></>
            ) : (
              <li className="inline-flex items-center text-gray-600">
                <svg
                  className="mr-2 h-4 w-4 fill-current text-green-400"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 512 512"
                >
                  <path d="M256 0C114.6 0 0 114.6 0 256s114.6 256 256 256s256-114.6 256-256S397.4 0 256 0zM371.8 211.8l-128 128C238.3 345.3 231.2 348 224 348s-14.34-2.719-19.81-8.188l-64-64c-10.91-10.94-10.91-28.69 0-39.63c10.94-10.94 28.69-10.94 39.63 0L224 280.4l108.2-108.2c10.94-10.94 28.69-10.94 39.63 0C382.7 183.1 382.7 200.9 371.8 211.8z"></path>
                </svg>
                Unlimited notes!
              </li>
            )}

            {topEditsTier.upto ? (
              <></>
            ) : (
              <li className="inline-flex items-center text-gray-600">
                <svg
                  className="mr-2 h-4 w-4 fill-current text-green-400"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 512 512"
                >
                  <path d="M256 0C114.6 0 0 114.6 0 256s114.6 256 256 256s256-114.6 256-256S397.4 0 256 0zM371.8 211.8l-128 128C238.3 345.3 231.2 348 224 348s-14.34-2.719-19.81-8.188l-64-64c-10.91-10.94-10.91-28.69 0-39.63c10.94-10.94 28.69-10.94 39.63 0L224 280.4l108.2-108.2c10.94-10.94 28.69-10.94 39.63 0C382.7 183.1 382.7 200.9 371.8 211.8z"></path>
                </svg>
                Unlimited edits!
              </li>
            )}

            <li className="inline-flex items-center text-gray-600">
              <svg
                className="mr-2 h-4 w-4 fill-current text-green-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 512 512"
              >
                <path d="M256 0C114.6 0 0 114.6 0 256s114.6 256 256 256s256-114.6 256-256S397.4 0 256 0zM371.8 211.8l-128 128C238.3 345.3 231.2 348 224 348s-14.34-2.719-19.81-8.188l-64-64c-10.91-10.94-10.91-28.69 0-39.63c10.94-10.94 28.69-10.94 39.63 0L224 280.4l108.2-108.2c10.94-10.94 28.69-10.94 39.63 0C382.7 183.1 382.7 200.9 371.8 211.8z"></path>
              </svg>
              {firstEditsTier.upto} edits free
            </li>
            {editsTiers.slice(1).map((tier, key) => (
              <li key={key} className="inline-flex items-center text-gray-600">
                <svg
                  className="mr-2 h-4 w-4 fill-current text-green-400"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 512 512"
                >
                  <path d="M256 0C114.6 0 0 114.6 0 256s114.6 256 256 256s256-114.6 256-256S397.4 0 256 0zM371.8 211.8l-128 128C238.3 345.3 231.2 348 224 348s-14.34-2.719-19.81-8.188l-64-64c-10.91-10.94-10.91-28.69 0-39.63c10.94-10.94 28.69-10.94 39.63 0L224 280.4l108.2-108.2c10.94-10.94 28.69-10.94 39.63 0C382.7 183.1 382.7 200.9 371.8 211.8z"></path>
                </svg>
                {tier.upto ? `Up to ${tier.upto} edits: ` : "Beyond that: "}
                {tier.price ? `${fmt.format(tier.price)} per 100` : "Free!"}
              </li>
            ))}
          </ul>
        </div>
        <div className="absolute bottom-0 w-full pb-4 pr-10">
          {name !== currentPlan ? (
            <Form method="post" className="mx-auto">
              <input type="hidden" name="plan" value={name} />
              <input
                type="submit"
                className="w-full cursor-pointer rounded-lg bg-gray-500 px-3 py-2 text-white hover:bg-gray-800"
                value="Sign up"
              />
            </Form>
          ) : (
            <div className="mx-auto">
              <div className="w-full rounded-lg bg-gray-400 px-3 py-2 text-center text-white">
                Current Plan
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default function PricingPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const currentPlan = actionData?.plans?.[0] || data.plans?.[0];
  const user = useOptionalUser();
  return (
    <>
      <div className="flex h-full min-h-screen flex-col">
        <header className="flex items-center justify-between bg-slate-800 p-4 text-white">
          {!user ? (
            <>
              <h1 className="text-3xl font-bold">
                Pricing{" "}
                <span className="text-2xl font-normal">
                  <Link to="/notes">Login to App</Link>
                </span>
              </h1>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold">
                Pricing{" "}
                <span className="text-2xl font-normal">
                  <Link to="/notes">Return to App</Link>
                </span>
              </h1>
              <p>{user.email}</p>
              <Form action="/logout" method="post">
                <button
                  type="submit"
                  className="rounded bg-slate-600 py-2 px-4 text-blue-100 hover:bg-blue-500 active:bg-blue-600"
                >
                  Logout
                </button>
              </Form>
            </>
          )}
        </header>
        <div className="my-8 mx-auto grid w-full grid-cols-1 gap-6 md:w-5/6 md:grid-cols-4">
          <>
            {Object.entries(data.model.plans).map(([name, plan], key) => (
              <Card
                name={name as PlanName}
                plan={plan}
                key={key}
                currentPlan={currentPlan as PlanName | undefined}
              />
            ))}
          </>
        </div>
      </div>
    </>
  );
}
