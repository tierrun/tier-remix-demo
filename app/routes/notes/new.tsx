import type { ActionArgs, LoaderArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react";
import * as React from "react";

import { createNote } from "~/models/note.server";
import tier from "~/models/tier.server";
import { requireUserId } from "~/session.server";

export async function action({ request }: ActionArgs) {
  const userId = await requireUserId(request);

  const formData = await request.formData();
  const title = formData.get("title");
  const body = formData.get("body");

  if (typeof title !== "string" || title.length === 0) {
    return json(
      { errors: { code: "", title: "Title is required", body: null } },
      { status: 400 }
    );
  }

  if (typeof body !== "string" || body.length === 0) {
    return json(
      { errors: { code: "", body: "Body is required", title: null } },
      { status: 400 }
    );
  }

  try {
    const note = await createNote({ title, body, userId });
    return redirect(`/notes/${note.id}`);
  } catch (er) {
    const noteEr = er as Error & {
      cause: {
        status: number;
        code: string;
      };
    };
    return json(
      {
        errors: { code: noteEr.cause.code, title: noteEr.message, body: null },
      },
      { status: noteEr.cause.status }
    );
  }
}

export async function loader({ request }: LoaderArgs) {
  const userId = await requireUserId(request);
  // can they create a new note?
  const answer = await tier.can(`org:${userId}`, "feature:notes:total");
  return json(answer);
}

export default function NewNotePage() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const titleRef = React.useRef<HTMLInputElement>(null);
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (actionData?.errors?.title) {
      titleRef.current?.focus();
    } else if (actionData?.errors?.body) {
      bodyRef.current?.focus();
    }
  }, [actionData]);

  return loaderData?.ok === false ? (
    <>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          width: "100%",
        }}
      >
        <div className="pt-1 text-red-700" id="title-error">
          <>
            Cannot create note, at plan limit.{" "}
            <Link className="text-blue-500" to="/pricing">
              Upgrade your plan
            </Link>
          </>
        </div>
      </div>
    </>
  ) : (
    <Form
      method="post"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        width: "100%",
      }}
    >
      <div>
        <label className="flex w-full flex-col gap-1">
          <span>Title: </span>
          <input
            ref={titleRef}
            name="title"
            className="flex-1 rounded-md border-2 border-blue-500 px-3 text-lg leading-loose"
            aria-invalid={actionData?.errors?.title ? true : undefined}
            aria-errormessage={
              actionData?.errors?.title ? "title-error" : undefined
            }
          />
        </label>
        {actionData?.errors?.title && (
          <div className="pt-1 text-red-700" id="title-error">
            {actionData.errors.title}
            {actionData.errors.code === "plan_limit" ? (
              <>
                {" "}
                <Link className="text-blue-500" to="/pricing">
                  Upgrade your plan
                </Link>
              </>
            ) : (
              ""
            )}
          </div>
        )}
      </div>

      <div>
        <label className="flex w-full flex-col gap-1">
          <span>Body: </span>
          <textarea
            ref={bodyRef}
            name="body"
            rows={8}
            className="w-full flex-1 rounded-md border-2 border-blue-500 py-2 px-3 text-lg leading-6"
            aria-invalid={actionData?.errors?.body ? true : undefined}
            aria-errormessage={
              actionData?.errors?.body ? "body-error" : undefined
            }
          />
        </label>
        {actionData?.errors?.body && (
          <div className="pt-1 text-red-700" id="body-error">
            {actionData.errors.body}
          </div>
        )}
      </div>

      <div className="text-right">
        <button
          type="submit"
          className="rounded bg-blue-500  py-2 px-4 text-white hover:bg-blue-600 focus:bg-blue-400"
        >
          Save
        </button>
      </div>
    </Form>
  );
}
