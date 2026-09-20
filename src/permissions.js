export const STAFF_FLAGS=Object.freeze(['Administrator','ManageGuild','ManageMessages']);
export function isStaffInteraction(interaction){const guild=interaction?.guild;const permissions=interaction?.memberPermissions;if(!guild||!permissions)return false;if(guild.ownerId===interaction.user?.id)return true;return STAFF_FLAGS.some(flag=>permissions.has(flag));}
export function canViewPublicData(){return true;}
export function assertStaff(interaction){if(isStaffInteraction(interaction))return true;const error=new Error('This action is limited to the server owner or approved Discord staff.');error.code='STAFF_ONLY';throw error;}
