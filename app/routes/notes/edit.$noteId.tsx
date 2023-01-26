import type { ActionArgs, LoaderArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useActionData, useCatch, useLoaderData } from "@remix-run/react";
import * as React from "react";
import invariant from "tiny-invariant";

import { deleteNote, editNote, getNote } from "~/models/note.server";
import tier from "~/models/tier.server";
import { requireUserId } from "~/session.server";

export async function loader({ request, params }: LoaderArgs) {
  const userId = await requireUserId(request);
  invariant(params.noteId, "noteId not found");

  const note = await getNote({ userId, id: params.noteId });
  if (!note) {
    throw new Response("Not Found", { status: 404 });
  }
  const answer = await tier.can(`org:${userId}`, 'feature:notes:edit')
  return json({ note, ok: answer.ok });
}

export async function action({ request, params }: ActionArgs) {
  const userId = await requireUserId(request);
  invariant(params.noteId, "noteId not found");
  const formData = await request.formData();
  const del = formData.get("delete");
  if (del === "true") {
    await deleteNote({ userId, id: params.noteId });
  }

  // otherwise we probably have updated title/body
  const title = formData.get("title");
  const body = formData.get("body");
  const id = formData.get("id");

  if (typeof id !== "string" || id.length === 0) {
    return json(
      { errors: { code: '', title: "note id is required", body: null } },
      { status: 400 }
    );
  }

  if (typeof title !== "string" || title.length === 0) {
    return json(
      { errors: { code: '', title: "Title is required", body: null } },
      { status: 400 }
    );
  }

  if (typeof body !== "string" || body.length === 0) {
    return json(
      { errors: { code: '', body: "Body is required", title: null } },
      { status: 400 }
    );
  }

  try {
    await editNote({ id, userId, title, body });
  } catch (er) {
    const noteEr = er as Error & {
      cause: {
        status: number;
        code: string;
      };
    };
    return json(
      { errors: { code: noteEr.cause.code, title: noteEr.message, body: null } },
      { status: noteEr.cause.status }
    );
  }

  return redirect(`/notes/${id}`);
}

export default function NoteDetailsPage() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const titleRef = React.useRef<HTMLInputElement>(null);
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);

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
            Cannot edit note, at plan limit.{" "}
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
      <input type="hidden" name="id" value={loaderData.note.id} />
      <div>
        <label className="flex w-full flex-col gap-1">
          <span>Title: </span>
          <input
            defaultValue={loaderData.note.title}
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
            defaultValue={loaderData.note.body}
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

export function ErrorBoundary({ error }: { error: Error }) {
  console.error(error);

  return <div>An unexpected error occurred: {error.message}</div>;
}

export function CatchBoundary() {
  const caught = useCatch();

  if (caught.status === 404) {
    return <div>Note not found</div>;
  }

  throw new Error(`Unexpected caught response with status: ${caught.status}`);
}
