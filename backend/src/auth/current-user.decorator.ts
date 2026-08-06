import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser, AuthedRequest } from './jwt-auth.guard';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    return request.user;
  },
);
