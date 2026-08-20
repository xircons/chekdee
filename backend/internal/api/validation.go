package api

import (
	"github.com/labstack/echo/v4"
	oapimiddleware "github.com/oapi-codegen/echo-middleware"
)

// NewValidatorMiddleware returns Echo middleware that validates requests
// against the embedded OpenAPI spec. It is scaffolding for the endpoints
// added from Phase 4 onward: mount it on a feature's own route group so its
// request bodies and parameters are checked against the contract. The
// existing hand-written /auth and /healthz routes are intentionally left
// uncovered, so this is not mounted globally.
func NewValidatorMiddleware() (echo.MiddlewareFunc, error) {
	spec, err := GetSwagger()
	if err != nil {
		return nil, err
	}
	// The spec's server list only describes local dev; validating the request
	// host against it would reject anything running elsewhere.
	spec.Servers = nil
	return oapimiddleware.OapiRequestValidator(spec), nil
}
