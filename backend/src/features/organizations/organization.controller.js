/**
 * Organization controller — thin HTTP glue over the organization service.
 */
import * as organizationService from './organization.service.js';
import * as userService from '../users/user.service.js';
import asyncHandler from '../../utils/asyncHandler.js';
import ApiResponse from '../../utils/ApiResponse.js';
import { HTTP_STATUS } from '../../config/constants.js';

export const getMine = asyncHandler(async (req, res) => {
  const organization = await organizationService.getForUser(req.user);
  ApiResponse.send(res, HTTP_STATUS.OK, { organization }, 'Organization retrieved');
});

export const updateMine = asyncHandler(async (req, res) => {
  const organization = await organizationService.updateForUser(req.user, req.body);
  ApiResponse.send(res, HTTP_STATUS.OK, { organization }, 'Organization updated');
});

/**
 * List the members of the caller's organization. The user list service is
 * already tenant-scoped by the actor, so this is that list surfaced under the
 * organization resource for the members UI.
 */
export const listMembers = asyncHandler(async (req, res) => {
  const { users, meta } = await userService.listUsers(req.user, req.query);
  ApiResponse.send(res, HTTP_STATUS.OK, { members: users }, 'Members retrieved', meta);
});

export const inviteMember = asyncHandler(async (req, res) => {
  const member = await userService.inviteUser({
    actor: req.user,
    email: req.body.email,
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    role: req.body.role,
  });
  ApiResponse.send(res, HTTP_STATUS.CREATED, { member }, 'Invitation sent');
});

export const removeMember = asyncHandler(async (req, res) => {
  await userService.removeUser({ actor: req.user, targetId: req.params.id });
  ApiResponse.send(res, HTTP_STATUS.OK, null, 'Member removed');
});
