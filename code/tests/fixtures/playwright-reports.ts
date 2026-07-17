export const targetFailureReport = {
  suites: [
    {
      title: "login.spec.ts",
      specs: [
        {
          title: "signs in with the repair-target selector @repair-target",
          tags: ["repair-target"],
          tests: [
            {
              results: [
                {
                  status: "failed",
                  errors: [
                    {
                      message: "locator.click: Timeout exceeded while waiting for locator('#sign-in-button').",
                      stack: "tests/e2e/login.spec.ts:4:43",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      suites: [],
    },
  ],
};

export const unrelatedFailureReport = {
  suites: [
    {
      title: "login.spec.ts",
      specs: [
        {
          title: "shows the login controls",
          tags: [],
          tests: [{ results: [{ status: "failed", errors: [{ message: "Unrelated failure" }] }] }],
        },
      ],
      suites: [],
    },
  ],
};

export const timedOutTargetFailureReport = {
  suites: [
    {
      title: "login.spec.ts",
      specs: [
        {
          title: "signs in with the repair-target selector @repair-target",
          tags: ["repair-target"],
          tests: [
            {
              results: [
                {
                  status: "timedOut",
                  errors: [
                    { message: "Test timeout of 10000ms exceeded." },
                    {
                      message: "locator.click: Test timeout exceeded while waiting for locator('#sign-in-button').",
                      stack: "tests/e2e/login.spec.ts:34:41",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      suites: [],
    },
  ],
};
