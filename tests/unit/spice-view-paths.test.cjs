const assert = require("node:assert/strict");
const test = require("node:test");
const { map } = require("../../packages/spice-view-paths/src/index.cjs");

test("maps conventional source, tests, resources, and generated files", () => {
  assert.deepEqual(
    map(
      "internal/users/user_service.go",
      "package users\n\n// @Service\ntype UserService struct{}\n",
      "commerce",
    ),
    {
      canonicalPath: "internal/users/user_service.go",
      viewPath: "src/main/go/users/application/UserService.go",
      category: "Source",
      role: "application",
      readOnly: false,
      sourceCanonicalPath: null,
    },
  );
  assert.equal(
    map(
      "internal/users/user_service_test.go",
      "package users\n\nfunc TestUserService_Create() {}\n",
    ).viewPath,
    "src/test/go/users/application/UserServiceTest.go",
  );
  assert.equal(
    map("src/main/resources/application.yaml").viewPath,
    "src/main/resources/application.yaml",
  );
  assert.deepEqual(map("internal/spicegen/commerce/application.go"), {
    canonicalPath: "internal/spicegen/commerce/application.go",
    viewPath: "build/generated/spice/commerce/application.go",
    category: "Generated Sources",
    role: "generated",
    readOnly: true,
    sourceCanonicalPath: null,
  });
});

test("maps application roots and rejects unsafe or unrelated paths", () => {
  assert.equal(
    map(
      "cmd/commerce/main.go",
      "package main\n\n// @Application\nfunc main() {}",
      "commerce",
    ).viewPath,
    "src/main/go/CommerceApplication.go",
  );
  assert.equal(map("../internal/users/user.go"), null);
  assert.equal(map("README.md"), null);
});

test("reports a straightforward physical production association for tests", () => {
  const mapped = map(
    "internal/users/user_controller_test.go",
    "package users\n\nfunc TestUserController_HTTP() {}\n",
  );
  assert.equal(mapped.viewPath, "src/test/go/users/web/UserControllerTest.go");
  assert.equal(mapped.sourceCanonicalPath, "internal/users/user_controller.go");
});

test("uses only the primary declaration annotations for role inference", () => {
  const mapped = map(
    "internal/orders/order_service.go",
    `package orders

// OrderService coordinates orders. Example: @Controller belongs on adapters.
type OrderService struct{}

// @Controller
func RegisterRoutes() {}
`,
  );
  assert.equal(
    mapped.viewPath,
    "src/main/go/orders/application/OrderService.go",
  );
  assert.equal(
    map(
      "internal/orders/order_endpoint.go",
      `package orders

// @Controller
// @Service
type OrderEndpoint struct{}
`,
    ),
    null,
  );
});
