'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Search,
  Plus,
  Star,
  Phone,
  Edit,
  Trash2,
  MessageSquare,
  MapPin,
  Mail,
  Globe,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

type LeadStatus = 'new' | 'contacted' | 'interested' | 'converted' | 'rejected';

interface Lead {
  id: string;
  business_name: string;
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  district?: string;
  rating?: number;
  review_count?: number;
  status: LeadStatus;
  lead_number?: string;
  source?: string;
  instagram?: string;
  website?: string;
  created_at: string;
}

const STATUS_CONFIG: Record<LeadStatus, { label: string; className: string }> = {
  new: { label: 'Yeni', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  contacted: { label: 'İletişimde', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  interested: { label: 'İlgili', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  converted: { label: 'Dönüştü', className: 'bg-purple-50 text-purple-700 border-purple-200' },
  rejected: { label: 'Reddedildi', className: 'bg-zinc-50 text-zinc-700 border-zinc-200' },
};

const DEFAULT_STATUS = STATUS_CONFIG.new;
const RATE_LIMIT_SECONDS = 45;

const formatPhone = (phone: string): string => {
  if (!phone) return '-';
  if (phone.startsWith('+90')) return phone;
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('90') && cleaned.length === 12) {
    return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8, 10)} ${cleaned.slice(10)}`;
  }
  return phone;
};

export default function LeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [bulkMessage, setBulkMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({
    total: 0,
    sent: 0,
    failed: 0,
  });
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showDetailPanel, setShowDetailPanel] = useState(false);

  const loadLeads = async () => {
    try {
      const res = await fetch('/api/leads');
      const data = await res.json();
      if (data.success) {
        setLeads(data.data);
      }
    } catch (error) {
      console.error('Adaylar yüklenemedi:', error);
    }
  };

  useEffect(() => {
    loadLeads();
  }, []);

  const handleRowClick = (lead: Lead) => {
    setSelectedLead(lead);
    setShowDetailPanel(true);
  };

  const processQueue = async (total: number) => {
    let attempts = 0;

    const sendNext = async () => {
      if (attempts >= total) {
        setSending(false);
        await loadLeads();
        return;
      }

      try {
        const res = await fetch('/api/leads/send');
        const data = await res.json();

        if (data.sent) {
          setSendProgress((prev) => ({ ...prev, sent: prev.sent + 1 }));
          toast.success(data.message);
          attempts++;
          if (attempts < total) {
            setTimeout(sendNext, RATE_LIMIT_SECONDS * 1000);
          } else {
            setSending(false);
            await loadLeads();
          }
          return;
        }

        if (data.failed) {
          setSendProgress((prev) => ({ ...prev, failed: prev.failed + 1 }));
          attempts++;
          if (attempts < total) {
            setTimeout(sendNext, RATE_LIMIT_SECONDS * 1000);
          } else {
            setSending(false);
            await loadLeads();
          }
          return;
        }

        setSending(false);
        await loadLeads();
      } catch (error) {
        console.error('Kuyruk işleme hatası:', error);
        setSending(false);
      }
    };

    sendNext();
  };

  const handleBulkSend = async () => {
    if (selectedLeads.length === 0 || !bulkMessage.trim()) {
      toast.error('Lütfen en az bir aday seçin ve mesaj yazın');
      return;
    }

    if (
      !confirm(
        `${selectedLeads.length} adaya mesaj göndermek istediğinize emin misiniz?`
      )
    ) {
      return;
    }

    setSending(true);
    setSendProgress({ total: selectedLeads.length, sent: 0, failed: 0 });

    try {
      const res = await fetch('/api/leads/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadIds: selectedLeads,
          message: bulkMessage,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(`${data.count} mesaj kuyruğa eklendi`);
        const count = data.count as number;
        setBulkMessage('');
        setSelectedLeads([]);
        await processQueue(count);
      } else {
        toast.error(data.error || 'Gönderim başarısız');
        setSending(false);
      }
    } catch (error) {
      console.error('Toplu gönderim hatası:', error);
      toast.error('Bir hata oluştu');
      setSending(false);
    }
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedLeads(filteredLeads.map((l) => l.id));
    } else {
      setSelectedLeads([]);
    }
  };

  const filteredLeads = leads.filter((lead) => {
    const q = search.toLowerCase();
    const business = lead.business_name?.toLowerCase() ?? '';
    const contactName = lead.name?.toLowerCase() ?? '';
    const district = lead.district?.toLowerCase() ?? '';
    const matchesSearch =
      !q ||
      business.includes(q) ||
      contactName.includes(q) ||
      district.includes(q);
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const allFilteredSelected =
    filteredLeads.length > 0 &&
    filteredLeads.every((l) => selectedLeads.includes(l.id));

  const detailStatus =
    selectedLead?.status && STATUS_CONFIG[selectedLead.status]
      ? STATUS_CONFIG[selectedLead.status]
      : DEFAULT_STATUS;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
          Adaylar
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Google Maps'ten toplanan pilates stüdyoları
        </p>
      </div>

      {selectedLeads.length > 0 && (
        <Card className="mb-4 border-blue-200 bg-blue-50/50 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-zinc-950">
                {selectedLeads.length} aday seçildi
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Spam koruması: Mesajlar arası {RATE_LIMIT_SECONDS} saniye
                bekleme · Günlük max 25
              </p>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Mesajınızı yazın..."
                value={bulkMessage}
                onChange={(e) => setBulkMessage(e.target.value)}
                className="w-96"
                disabled={sending}
              />
              <Button
                onClick={handleBulkSend}
                disabled={sending || !bulkMessage.trim()}
                className="bg-zinc-950 text-white hover:bg-zinc-800"
              >
                {sending ? 'Gönderiliyor...' : 'Toplu Gönder'}
              </Button>
            </div>
          </div>
          {sendProgress.total > 0 && (
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-xs text-zinc-600">
                <span>
                  İlerleme: {sendProgress.sent}/{sendProgress.total}
                  {sendProgress.failed > 0
                    ? ` · ${sendProgress.failed} hata`
                    : ''}
                </span>
                <span>
                  {Math.round(
                    (sendProgress.sent / sendProgress.total) * 100
                  )}
                  %
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-zinc-200">
                <div
                  className="h-2 rounded-full bg-emerald-500 transition-all"
                  style={{
                    width: `${(sendProgress.sent / sendProgress.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}
        </Card>
      )}

      <Card className="p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              placeholder="İşletme ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm"
          >
            <option value="all">Tüm Durumlar</option>
            <option value="new">Yeni</option>
            <option value="contacted">İletişimde</option>
            <option value="interested">İlgili</option>
            <option value="converted">Dönüştü</option>
            <option value="rejected">Reddedildi</option>
          </select>
          <Button variant="outline">Import</Button>
          <Button className="bg-zinc-950 text-white hover:bg-zinc-800">
            <Plus className="mr-2 h-4 w-4" />
            Yeni Aday
          </Button>
        </div>

        <div className="overflow-hidden rounded-lg border border-zinc-200">
          <table className="w-full table-fixed">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/50">
                <th className="w-10 p-3 text-left">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={(e) => toggleSelectAll(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300"
                    aria-label="Tümünü seç"
                  />
                </th>
                <th className="w-[32%] p-3 text-left text-xs font-medium text-zinc-500 uppercase">
                  İŞLETME
                </th>
                <th className="w-[20%] p-3 text-left text-xs font-medium text-zinc-500 uppercase">
                  SAHİP
                </th>
                <th className="w-[12%] p-3 text-left text-xs font-medium text-zinc-500 uppercase">
                  DURUM
                </th>
                <th className="w-[14%] p-3 text-left text-xs font-medium text-zinc-500 uppercase">
                  KAYIT
                </th>
                <th className="w-[14%] p-3 text-left text-xs font-medium text-zinc-500 uppercase">
                  İŞLEMLER
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead) => {
                const businessName =
                  lead.business_name?.trim() || 'İsimsiz işletme';
                const status =
                  lead.status && STATUS_CONFIG[lead.status]
                    ? STATUS_CONFIG[lead.status]
                    : DEFAULT_STATUS;
                const initials =
                  businessName
                    .split(' ')
                    .filter(Boolean)
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase() || '?';
                const hasPhone = Boolean(lead.phone?.trim());
                const locationLabel =
                  lead.district || lead.city || null;

                return (
                  <tr
                    key={lead.id}
                    className="cursor-pointer border-b border-zinc-100 hover:bg-zinc-50/50"
                    onClick={() => handleRowClick(lead)}
                  >
                    <td
                      className="p-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedLeads.includes(lead.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedLeads((prev) => [...prev, lead.id]);
                          } else {
                            setSelectedLeads((prev) =>
                              prev.filter((id) => id !== lead.id)
                            );
                          }
                        }}
                        className="h-4 w-4 rounded border-zinc-300"
                      />
                    </td>
                    <td className="p-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar className="shrink-0">
                          <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-teal-500 text-xs text-white">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-zinc-950">
                            {businessName}
                          </p>
                          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-2 text-xs text-zinc-500">
                            {locationLabel && (
                              <span className="flex min-w-0 items-center gap-1">
                                <MapPin className="h-3 w-3 shrink-0" />
                                <span className="truncate">{locationLabel}</span>
                              </span>
                            )}
                            {lead.rating != null && (
                              <span className="flex shrink-0 items-center gap-1">
                                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                {lead.rating}
                                {lead.review_count != null
                                  ? ` (${lead.review_count})`
                                  : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="min-w-0">
                        {lead.name && (
                          <p className="truncate text-sm text-zinc-950">
                            {lead.name}
                          </p>
                        )}
                        {lead.phone && (
                          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-zinc-500">
                            <Phone className="h-3 w-3 shrink-0" />
                            <span className="truncate">
                              {formatPhone(lead.phone)}
                            </span>
                          </p>
                        )}
                        {!lead.name && !lead.phone && (
                          <p className="text-xs text-zinc-400">—</p>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className={status.className}>
                        {status.label}
                      </Badge>
                    </td>
                    <td className="p-3 text-sm text-zinc-500">
                      {lead.created_at
                        ? new Date(lead.created_at).toLocaleDateString('tr-TR')
                        : '-'}
                    </td>
                    <td
                      className="p-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={!hasPhone}
                          title={
                            hasPhone
                              ? 'Mesaj Gönder'
                              : 'Telefon numarası yok'
                          }
                          onClick={() => {
                            if (hasPhone) {
                              router.push(
                                `/conversations?leadId=${lead.id}`
                              );
                            }
                          }}
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleRowClick(lead)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredLeads.length === 0 && (
            <div className="p-8 text-center text-sm text-zinc-500">
              Aday bulunamadı
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-zinc-500">
          <p>
            1-{filteredLeads.length} arası {filteredLeads.length} kayıt
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled>
              Next
            </Button>
          </div>
        </div>
      </Card>

      {showDetailPanel && selectedLead && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowDetailPanel(false)}
          />

          <div className="relative h-full w-[480px] overflow-y-auto bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white p-4">
              <h2 className="text-lg font-semibold text-zinc-950">
                İşletme Detayı
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDetailPanel(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-6 p-6">
              <div>
                <h3 className="mb-2 text-xl font-semibold text-zinc-950">
                  {selectedLead.business_name}
                </h3>
                <Badge variant="outline" className={detailStatus.className}>
                  {detailStatus.label}
                </Badge>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-medium text-zinc-500 uppercase">
                  İletişim
                </h4>

                {selectedLead.phone && (
                  <div className="flex items-center gap-3 rounded-lg bg-zinc-50 p-3">
                    <Phone className="h-5 w-5 text-zinc-500" />
                    <div>
                      <p className="text-sm font-medium text-zinc-950">
                        {formatPhone(selectedLead.phone)}
                      </p>
                      <p className="text-xs text-zinc-500">Telefon</p>
                    </div>
                  </div>
                )}

                {selectedLead.email && (
                  <div className="flex items-center gap-3 rounded-lg bg-zinc-50 p-3">
                    <Mail className="h-5 w-5 text-zinc-500" />
                    <div>
                      <p className="text-sm font-medium text-zinc-950">
                        {selectedLead.email}
                      </p>
                      <p className="text-xs text-zinc-500">E-posta</p>
                    </div>
                  </div>
                )}

                {selectedLead.name && (
                  <div className="flex items-center gap-3 rounded-lg bg-zinc-50 p-3">
                    <div>
                      <p className="text-sm font-medium text-zinc-950">
                        {selectedLead.name}
                      </p>
                      <p className="text-xs text-zinc-500">İlgili kişi</p>
                    </div>
                  </div>
                )}
              </div>

              {(selectedLead.city ||
                selectedLead.district ||
                selectedLead.address) && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-zinc-500 uppercase">
                    Konum
                  </h4>
                  <div className="rounded-lg bg-zinc-50 p-3">
                    <p className="flex items-start gap-2 text-sm text-zinc-950">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
                      <span>
                        {[selectedLead.district, selectedLead.city]
                          .filter(Boolean)
                          .join(', ')}
                      </span>
                    </p>
                    {selectedLead.address && (
                      <p className="mt-1 pl-6 text-xs text-zinc-500">
                        {selectedLead.address}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {(selectedLead.rating != null ||
                selectedLead.review_count != null) && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-zinc-500 uppercase">
                    Google Değerlendirmesi
                  </h4>
                  <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <Star className="h-6 w-6 fill-amber-400 text-amber-400" />
                    <div>
                      <p className="text-lg font-semibold text-zinc-950">
                        {selectedLead.rating ?? '—'}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {selectedLead.review_count ?? 0} yorum
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {(selectedLead.instagram || selectedLead.website) && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-zinc-500 uppercase">
                    Sosyal Medya
                  </h4>
                  {selectedLead.instagram && (
                    <a
                      href={selectedLead.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-lg bg-zinc-50 p-3 transition-colors hover:bg-zinc-100"
                    >
                      <Globe className="h-5 w-5 text-zinc-500" />
                      <p className="truncate text-sm text-blue-600 hover:underline">
                        {selectedLead.instagram}
                      </p>
                    </a>
                  )}
                  {selectedLead.website && (
                    <a
                      href={selectedLead.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-lg bg-zinc-50 p-3 transition-colors hover:bg-zinc-100"
                    >
                      <Globe className="h-5 w-5 text-zinc-500" />
                      <p className="truncate text-sm text-blue-600 hover:underline">
                        {selectedLead.website}
                      </p>
                    </a>
                  )}
                </div>
              )}

              <div className="space-y-2 border-t border-zinc-200 pt-4">
                {selectedLead.lead_number && (
                  <p className="text-xs text-zinc-500">
                    Lead No: {selectedLead.lead_number}
                  </p>
                )}
                {selectedLead.source && (
                  <p className="text-xs text-zinc-500">
                    Kaynak: {selectedLead.source}
                  </p>
                )}
                <p className="text-xs text-zinc-500">
                  Kayıt:{' '}
                  {new Date(selectedLead.created_at).toLocaleString('tr-TR')}
                </p>
              </div>

              <div className="space-y-2 border-t border-zinc-200 pt-4">
                <Button
                  className="w-full bg-emerald-500 text-white hover:bg-emerald-600"
                  disabled={!selectedLead.phone?.trim()}
                  onClick={() => {
                    window.location.href = `/conversations?leadId=${selectedLead.id}`;
                  }}
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Mesaj Gönder
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
