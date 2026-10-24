'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Search, Plus, Star, Phone, Edit, Trash2, MessageSquare } from 'lucide-react';

type LeadStatus = 'new' | 'contacted' | 'interested' | 'converted' | 'rejected';

interface Lead {
  id: string;
  business_name?: string | null;
  owner_name?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  rating?: number | null;
  review_count?: number | null;
  status?: LeadStatus | null;
  last_contact_at?: string | null;
}

const STATUS_CONFIG: Record<LeadStatus, { label: string; className: string }> = {
  new: { label: 'Yeni', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  contacted: { label: 'İletişimde', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  interested: { label: 'İlgili', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  converted: { label: 'Dönüştü', className: 'bg-purple-50 text-purple-700 border-purple-200' },
  rejected: { label: 'Reddedildi', className: 'bg-zinc-50 text-zinc-700 border-zinc-200' },
};

const DEFAULT_STATUS = STATUS_CONFIG.new;

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

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

  const filteredLeads = leads.filter((lead) => {
    const q = search.toLowerCase();
    const name = lead.business_name?.toLowerCase() ?? '';
    const owner = lead.owner_name?.toLowerCase() ?? '';
    const matchesSearch = !q || name.includes(q) || owner.includes(q);
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
          Adaylar
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Google Maps'ten toplanan pilates stüdyoları
        </p>
      </div>

      <Card className="p-6">
        {/* Toolbar */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
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
            <Plus className="w-4 h-4 mr-2" />
            Yeni Aday
          </Button>
        </div>

        {/* Tablo */}
        <div className="border border-zinc-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-zinc-50/50 border-b border-zinc-200">
                <th className="text-left p-3 text-xs font-medium text-zinc-500 uppercase">İŞLETME</th>
                <th className="text-left p-3 text-xs font-medium text-zinc-500 uppercase">SAHİP</th>
                <th className="text-left p-3 text-xs font-medium text-zinc-500 uppercase">DURUM</th>
                <th className="text-left p-3 text-xs font-medium text-zinc-500 uppercase">SON İLETİŞİM</th>
                <th className="text-left p-3 text-xs font-medium text-zinc-500 uppercase">İŞLEMLER</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead) => {
                const businessName = lead.business_name?.trim() || 'İsimsiz işletme';
                const status = (lead.status && STATUS_CONFIG[lead.status])
                  ? STATUS_CONFIG[lead.status]
                  : DEFAULT_STATUS;
                const initials = businessName
                  .split(' ')
                  .filter(Boolean)
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase() || '?';

                return (
                <tr key={lead.id} className="border-b border-zinc-100 hover:bg-zinc-50/50">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-teal-500 text-white text-xs">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm text-zinc-950">{businessName}</p>
                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                          {lead.city && <span>{lead.city}</span>}
                          {lead.rating != null && (
                            <span className="flex items-center gap-1">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              {lead.rating} ({lead.review_count ?? 0})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    {lead.owner_name && <p className="text-sm text-zinc-950">{lead.owner_name}</p>}
                    {lead.phone && (
                      <p className="text-xs text-zinc-500 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {lead.phone}
                      </p>
                    )}
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className={status.className}>
                      {status.label}
                    </Badge>
                  </td>
                  <td className="p-3 text-sm text-zinc-500">
                    {lead.last_contact_at ? new Date(lead.last_contact_at).toLocaleDateString('tr-TR') : '-'}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MessageSquare className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50">
                        <Trash2 className="w-4 h-4" />
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

        {/* Pagination */}
        <div className="flex items-center justify-between mt-4 text-sm text-zinc-500">
          <p>1-{filteredLeads.length} arası {filteredLeads.length} kayıt</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled>Previous</Button>
            <Button variant="outline" size="sm" disabled>Next</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
