export const SERVICE_REQUEST_STATUSES = [
  'new', // Yeni
  'in_review', // İnceleniyor
  'scheduled', // Planlandı
  'done', // Tamamlandı
  'rejected', // Reddedildi
] as const;

export type ServiceRequestStatus = (typeof SERVICE_REQUEST_STATUSES)[number];

export const SERVICE_REQUEST_STATUS_LABELS_TR: Record<ServiceRequestStatus, string> = {
  new: 'Yeni',
  in_review: 'İnceleniyor',
  scheduled: 'Planlandı',
  done: 'Tamamlandı',
  rejected: 'Reddedildi',
};
