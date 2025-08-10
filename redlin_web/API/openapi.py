from drf_spectacular.extensions import OpenApiAuthenticationExtension


class JWTAuthScheme(OpenApiAuthenticationExtension):
    target_class = 'API.jwt_auth.JWTAuthentication'
    name = 'bearerAuth'
    match_subclasses = True

    def get_security_definition(self, auto_schema):
        return {
            'type': 'http',
            'scheme': 'bearer',
            'bearerFormat': 'JWT',
        }
