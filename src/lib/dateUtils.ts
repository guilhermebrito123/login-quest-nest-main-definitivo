const BRAZIL_OFFSET_MINUTES = 3 * 60; // UTC-3

const convertToBrazilDate = (date: Date) => {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const brazilTime = utc - BRAZIL_OFFSET_MINUTES * 60000;
  return new Date(brazilTime);
};

export const toBrazilISOString = (date: Date = new Date()) => {
  return convertToBrazilDate(date).toISOString();
};

export const toBrazilDateISOString = (dateString: string) => {
  return toBrazilISOString(new Date(`${dateString}T00:00:00`));
};
