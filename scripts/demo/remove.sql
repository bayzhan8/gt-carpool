-- Deletes every demo account; rides and memberships cascade.
delete from auth.users where email like '%@carpool-demo.gatech.edu';
