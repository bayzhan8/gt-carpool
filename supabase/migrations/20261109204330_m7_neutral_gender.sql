alter type public.gender rename value 'brother' to 'man';
alter type public.gender rename value 'sister' to 'woman';
alter type public.gender add value 'unspecified';

alter type public.ride_audience rename value 'brothers' to 'men';
alter type public.ride_audience rename value 'sisters' to 'women';
