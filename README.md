# Tier Remix Demo

This is an example of using [Tier](https://www.tier.run/) with
Remix to set up an application in no time with fully implemented
and configurable pricing.

## Remix Blues Stack Setup

We'll start with [The Remix Blues
Stack](https://github.com/remix-run/blues-stack), since it comes
with a nice setup using PostgreSQL and some basic features and
user management right out of the box, and ready to deploy to
[Fly.io](https://fly.io).

```
npx create-remix@latest --template remix-run/blues-stack
```

Let's just accept the defaults, they're pretty good:

```
? Where would you like to create your app? tier-remix-demo
? TypeScript or JavaScript? TypeScript
? Do you want me to run `npm install`? Yes
```

Next, let's do the basic stuff the Blues Stack provides for us.

```
$ npm run docker
$ npm run setup
$ npm run build
$ npm run dev
```

Open up <http://localhost:3000/> and verify that we see the Blues
Stack default home page. Great!

## Fix the audit warning `express-prometheus-middleware@1.2.0`

As of the time of this writing, the Remix Blues Stack depends on
`express-prometheus-middleware`, which pulls in an optional
dependency that has a security advisory against it. We can work
around that pretty easily, thankfully:

```
npm rm express-prometheus-middleware
npm install @isaacs/express-prometheus-middleware
```

This is just a fork that doesn't have the optional dep included.

```
$ npm audit
found 0 vulnerabilities
```

## Test the Un-Monetized App

From the Blues Stack docs:

> The database seed script creates a new user with some data you
> can use to get started:
>
> - Email: `rachel@remix.run`
> - Password: `racheliscool`

Head over to <http://localhost:3000/> and make sure you can log
in and create some notes.

Ok, time to set up pricing!

## Install Tier Binary

Instructions for installing the Tier binary on various operating
systems is provided [in the Tier docs](https://tier.run/docs/install/).

Once that's installed, we should see that we have a `tier`
executable available.

```
$ brew install tierrun/tap/tier
==> Fetching tierrun/tap/tier
==> Downloading https://github.com/tierrun/tier/releases/download/v0.7.1/tier_0.7.1_darwin_arm64.tar.gz
==> Installing tier from tierrun/tap
🍺  /opt/homebrew/Cellar/tier/0.7.1: 5 files, 7.9MB, built in 1 second
==> Running `brew cleanup tier`...

$ which tier
/opt/homebrew/bin/tier

$ tier version
0.7.1
  tier commit: d058cdac601f0764bd54f856de316ad068b5fcd4
  go version: go1.20rc2
```

### Connect Tier to Stripe

If this is your first time installing Tier, you'll need to
connect it to your Stripe account.

Run [`tier connect`](https://www.tier.run/docs/cli/connect) to do
this.

## Create a Tier Sandbox

To create a little sandbox to operate in, let's use the [`tier
switch -c`](https://www.tier.run/docs/cli/switch) command.

That way, any time we want to start over, we can just delete the
`tier.state` file and run `tier switch -c` again to get a brand
new clean slate. Also, add `tier.state` to .gitignore so we
don't leak that accidentally.

```
echo "tier.state" >> .gitignore
tier switch -c
```

## Install Tier SDK

Since this is a Node.js app, we'll use the [tier node
sdk](https://www.npmjs.com/package/tier).

```
npm install tier
```

## Create a Pricing Model

For this, we're going to use the [Tier Plan
Builder](https://model.tier.run/).

The model we're going to use is 4 plans:

### Free Plan

- 5 notes allowed
- Up to 100 edits per month
- No charge

### Basic Plan

- Up to 20 notes allowed. First 5 notes are free, and then a
  flat fee of $5 per month if they're over 5.
- No limit on the number of edits! First 1000 edits per month
  free, then $0.001 per edit (ie, $0.01 per 10 edits.)

To do this, we create two metered features with the appropriate
limits, and no charges.

Note that `feature:notes:total` sets the aggregate value to
"Maximum usage value", since we want to always charge based on
the total number of notes last reported, even if there hasn't
been any change during the billing period.

We also set the "Mode" to "Volume" to keep it consistent with the
other plans.

### Pro Plan

- No limit on the number of notes! First 5 are free, then a flat
  fee of $5 if they stay below 20 notes (like the Basic plan),
  and or a flat monthly fee of $20 up to 200 notes, or $0.10 per
  note if they're over 200.
- No limit on the number of edits! First 1000 edits are free,
  then $0.001 per edit up to 10,000 edits (ie, $0.01 per 10
  edits), and then $0.0005 per edit (ie, $0.01 per 20 edits).

To do this, we define our tiers just like the Free plan, but with
an extra tier on each.

Here, the "Volume" mode on the `feature:notes:total` is relevant,
because we want a user with 200 notes to be charged $20, not $25.
Then when they cross over to 201 notes, their price will go up to
$20.10. For 202 notes, $20.20, and so on. So we're charging
based on the _total_ volume, not breaking out the charge for
total notes in graduated levels.

### Pay As You Go Plan

- No limits on anything, and no flat rates!
- First 5 notes are free, then $1 per note.
- First 1000 edits are free, then $0.001 per edit (ie, $0.01 per
  10 edits).

On this one, we set the `feature:notes:total` mode to
"Graduated". So a user with 6 notes will be charged $0 for the
first 5, then $1.00 for the sixth. 7 notes will cost $2.00, 8
will cost $3.00, and so on.

At 10 notes, it makes sense for them to switch to the Basic plan,
and at 25 notes, it makes sense for them to switch to the Pro plan,
which is what we want to encourage.

## Result

Check out [the result in the Plan
Builder](https://model.tier.run/cldc4667n4anxhof5n6x0ps6i).

Let's push it!

```
$ tier push https://model.tier.run/cldc4667n4anxhof5n6x0ps6i
ok	plan:free@1	feature:notes:edit	https://dashboard.stripe.com/acct_1MSTLm4Eht4IU5DC/prices/price_1MUG404Eht4IU5DCbQwPfQgi	[created]
ok	plan:basic@1	feature:notes:edit	https://dashboard.stripe.com/acct_1MSTLm4Eht4IU5DC/prices/price_1MUG404Eht4IU5DCPQGkV7Vn	[created]
ok	plan:basic@1	feature:notes:total	https://dashboard.stripe.com/acct_1MSTLm4Eht4IU5DC/prices/price_1MUG404Eht4IU5DCWSDxROIT	[created]
ok	plan:paygo@1	feature:notes:edit	https://dashboard.stripe.com/acct_1MSTLm4Eht4IU5DC/prices/price_1MUG404Eht4IU5DCDRdxFUP0	[created]
ok	plan:paygo@1	feature:notes:total	https://dashboard.stripe.com/acct_1MSTLm4Eht4IU5DC/prices/price_1MUG414Eht4IU5DCHg2RrYEd	[created]
ok	plan:free@1	feature:notes:total	https://dashboard.stripe.com/acct_1MSTLm4Eht4IU5DC/prices/price_1MUG414Eht4IU5DCsFnlIdBL	[created]
ok	plan:pro@1	feature:notes:total	https://dashboard.stripe.com/acct_1MSTLm4Eht4IU5DC/prices/price_1MUG414Eht4IU5DC3XFeSCmC	[created]
ok	plan:pro@1	feature:notes:edit	https://dashboard.stripe.com/acct_1MSTLm4Eht4IU5DC/prices/price_1MUG414Eht4IU5DCQvm5k3nM	[created]
```

At this point, we can click on those the urls that Tier prints to
see the plans in Stripe, or run `tier pull` to see the result in
JSON format.

## Creating the Pricing Page

We can use the `tier.pullLatest()` method to pull the latest
version of each plan in our model, and then use that to create a
pricing page. {{TK link to pricing page edit, and url in live
demo}}

Use `tier.checkout()` to subscribe when they click the sign up
button.

## Default Free Plan

Update the app/models/user.server.ts model to subscribe users to
the latest `plan:free@...` if they're not subscribed to anything,
and on user creation.

## Cancel Plans when deleting users

When deleting an account, call `tier.cancel()` to cancel their
plan.

---

the rest is the remix blues stack readme

## Deployment

This Remix Stack comes with two GitHub Actions that handle automatically deploying your app to production and staging environments.

Prior to your first deployment, you'll need to do a few things:

- [Install Fly](https://fly.io/docs/getting-started/installing-flyctl/)

- Sign up and log in to Fly

  ```sh
  fly auth signup
  ```

  > **Note:** If you have more than one Fly account, ensure that you are signed into the same account in the Fly CLI as you are in the browser. In your terminal, run `fly auth whoami` and ensure the email matches the Fly account signed into the browser.

- Create two apps on Fly, one for staging and one for production:

  ```sh
  fly apps create tier-remix-demo
  fly apps create tier-remix-demo-staging
  ```

  > **Note:** Once you've successfully created an app, double-check the `fly.toml` file to ensure that the `app` key is the name of the production app you created. This Stack [automatically appends a unique suffix at init](https://github.com/remix-run/blues-stack/blob/4c2f1af416b539187beb8126dd16f6bc38f47639/remix.init/index.js#L29) which may not match the apps you created on Fly. You will likely see [404 errors in your Github Actions CI logs](https://community.fly.io/t/404-failure-with-deployment-with-remix-blues-stack/4526/3) if you have this mismatch.

- Initialize Git.

  ```sh
  git init
  ```

- Create a new [GitHub Repository](https://repo.new), and then add it as the remote for your project. **Do not push your app yet!**

  ```sh
  git remote add origin <ORIGIN_URL>
  ```

- Add a `FLY_API_TOKEN` to your GitHub repo. To do this, go to
  your user settings on Fly and create a new
  [token](https://web.fly.io/user/personal_access_tokens/new),
  then add it to [your repo
  secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
  with the name `FLY_API_TOKEN`.

- Add a `SESSION_SECRET` to your fly app secrets, to do this you can run the following commands:

  ```sh
  fly secrets set SESSION_SECRET=$(openssl rand -hex 32) --app tier-remix-demo
  fly secrets set SESSION_SECRET=$(openssl rand -hex 32) --app tier-remix-demo-staging
  ```

  > **Note:** When creating the staging secret, you may get a warning from the Fly CLI that looks like this:
  >
  > ```
  > WARN app flag 'tier-remix-demo-staging' does not match app name in config file 'tier-remix-demo'
  > ```
  >
  > This simply means that the current directory contains a config that references the production app we created in the first step. Ignore this warning and proceed to create the secret.

  If you don't have openssl installed, you can also use [1password](https://1password.com/password-generator/) to generate a random secret, just replace `$(openssl rand -hex 32)` with the generated secret.

- Create a database for both your staging and production environments. Run the following:

  ```sh
  fly postgres create --name tier-remix-demo-db
  fly postgres attach --app tier-remix-demo tier-remix-demo-db

  fly postgres create --name tier-remix-demo-staging-db
  fly postgres attach --app tier-remix-demo-staging tier-remix-demo-staging-db
  ```

  > **Note:** You'll get the same warning for the same reason when attaching the staging database that you did in the `fly set secret` step above. No worries. Proceed!

Fly will take care of setting the `DATABASE_URL` secret for you.

Now that everything is set up you can commit and push your changes to your repo. Every commit to your `main` branch will trigger a deployment to your production environment, and every commit to your `dev` branch will trigger a deployment to your staging environment.

If you run into any issues deploying to Fly, make sure you've followed all of the steps above and if you have, then post as many details about your deployment (including your app name) to [the Fly support community](https://community.fly.io). They're normally pretty responsive over there and hopefully can help resolve any of your deployment issues and questions.

### Multi-region deploys

Once you have your site and database running in a single region, you can add more regions by following [Fly's Scaling](https://fly.io/docs/reference/scaling/) and [Multi-region PostgreSQL](https://fly.io/docs/getting-started/multi-region-databases/) docs.

Make certain to set a `PRIMARY_REGION` environment variable for your app. You can use `[env]` config in the `fly.toml` to set that to the region you want to use as the primary region for both your app and database.

#### Testing your app in other regions

Install the [ModHeader](https://modheader.com/) browser extension (or something similar) and use it to load your app with the header `fly-prefer-region` set to the region name you would like to test.

You can check the `x-fly-region` header on the response to know which region your request was handled by.

## GitHub Actions

We use GitHub Actions for continuous integration and deployment. Anything that gets into the `main` branch will be deployed to production after running tests/build/etc. Anything in the `dev` branch will be deployed to staging.

## Testing

### Cypress

We use Cypress for our End-to-End tests in this project. You'll find those in the `cypress` directory. As you make changes, add to an existing file or create a new file in the `cypress/e2e` directory to test your changes.

We use [`@testing-library/cypress`](https://testing-library.com/cypress) for selecting elements on the page semantically.

To run these tests in development, run `npm run test:e2e:dev` which will start the dev server for the app as well as the Cypress client. Make sure the database is running in docker as described above.

We have a utility for testing authenticated features without having to go through the login flow:

```ts
cy.login();
// you are now logged in as a new user
```

We also have a utility to auto-delete the user at the end of your test. Just make sure to add this in each test file:

```ts
afterEach(() => {
  cy.cleanupUser();
});
```

That way, we can keep your local db clean and keep your tests isolated from one another.

### Vitest

For lower level tests of utilities and individual components, we use `vitest`. We have DOM-specific assertion helpers via [`@testing-library/jest-dom`](https://testing-library.com/jest-dom).

### Type Checking

This project uses TypeScript. It's recommended to get TypeScript set up for your editor to get a really great in-editor experience with type checking and auto-complete. To run type checking across the whole project, run `npm run typecheck`.

### Linting

This project uses ESLint for linting. That is configured in `.eslintrc.js`.

### Formatting

We use [Prettier](https://prettier.io/) for auto-formatting in this project. It's recommended to install an editor plugin (like the [VSCode Prettier plugin](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)) to get auto-formatting on save. There's also a `npm run format` script you can run to format all files in the project.
