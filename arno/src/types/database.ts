// =============================================================
// Arno — Types TypeScript miroir du schéma Supabase
// Prix en centimes (number)
// Format compatible supabase-js v2
// =============================================================

export type VehicleStatus = 'en_stock' | 'en_preparation' | 'en_vente' | 'vendu';

export type Database = {
  public: {
    Tables: {
      vehicles: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          stock_number: string | null;
          registration: string;
          vin: string | null;
          brand: string;
          model: string;
          sub_type: string | null;
          year: number;
          fuel_type: string;
          gearbox: string;
          mileage: number;
          power_hp: number | null;
          color: string | null;
          doors: number | null;
          seats: number | null;
          body_type: string | null;
          euro_norm: string | null;
          total_owners: number | null;
          status: VehicleStatus;
          condition: string | null;
          is_accident: boolean | null;
          damages: string | null;
          ct_status: string | null;
          ct_date: string | null;
          purchase_price: number;
          purchase_date: string;
          purchase_source: string;
          seller_name: string | null;
          purchase_notes: string | null;
          target_sale_price: number | null;
          sale_price: number | null;
          sale_date: string | null;
          buyer_name: string | null;
          sale_notes: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          stock_number?: string | null;
          registration: string;
          vin?: string | null;
          brand: string;
          model: string;
          sub_type?: string | null;
          year: number;
          fuel_type: string;
          gearbox: string;
          mileage: number;
          power_hp?: number | null;
          color?: string | null;
          doors?: number | null;
          seats?: number | null;
          body_type?: string | null;
          euro_norm?: string | null;
          total_owners?: number | null;
          status?: VehicleStatus;
          condition?: string | null;
          is_accident?: boolean | null;
          damages?: string | null;
          ct_status?: string | null;
          ct_date?: string | null;
          purchase_price: number;
          purchase_date: string;
          purchase_source: string;
          seller_name?: string | null;
          purchase_notes?: string | null;
          target_sale_price?: number | null;
          sale_price?: number | null;
          sale_date?: string | null;
          buyer_name?: string | null;
          sale_notes?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          stock_number?: string | null;
          registration?: string;
          vin?: string | null;
          brand?: string;
          model?: string;
          sub_type?: string | null;
          year?: number;
          fuel_type?: string;
          gearbox?: string;
          mileage?: number;
          power_hp?: number | null;
          color?: string | null;
          doors?: number | null;
          seats?: number | null;
          body_type?: string | null;
          euro_norm?: string | null;
          total_owners?: number | null;
          status?: VehicleStatus;
          condition?: string | null;
          is_accident?: boolean | null;
          damages?: string | null;
          ct_status?: string | null;
          ct_date?: string | null;
          purchase_price?: number;
          purchase_date?: string;
          purchase_source?: string;
          seller_name?: string | null;
          purchase_notes?: string | null;
          target_sale_price?: number | null;
          sale_price?: number | null;
          sale_date?: string | null;
          buyer_name?: string | null;
          sale_notes?: string | null;
        };
        Relationships: [
          { foreignKeyName: 'vehicles_created_by_fkey'; columns: ['created_by']; isOneToOne: false; referencedRelation: 'users'; referencedColumns: ['id'] },
        ];
      };
      vehicle_photos: {
        Row: {
          id: string;
          vehicle_id: string;
          url: string;
          position: number;
          is_primary: boolean;
          imported_from_auto1: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          vehicle_id: string;
          url: string;
          position?: number;
          is_primary?: boolean;
          imported_from_auto1?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          vehicle_id?: string;
          url?: string;
          position?: number;
          is_primary?: boolean;
          imported_from_auto1?: boolean;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: 'vehicle_photos_vehicle_id_fkey'; columns: ['vehicle_id']; isOneToOne: false; referencedRelation: 'vehicles'; referencedColumns: ['id'] },
        ];
      };
      vehicle_documents: {
        Row: {
          id: string;
          vehicle_id: string;
          type: string;
          file_url: string;
          name: string;
          uploaded_at: string;
        };
        Insert: {
          id?: string;
          vehicle_id: string;
          type: string;
          file_url: string;
          name: string;
          uploaded_at?: string;
        };
        Update: {
          id?: string;
          vehicle_id?: string;
          type?: string;
          file_url?: string;
          name?: string;
          uploaded_at?: string;
        };
        Relationships: [
          { foreignKeyName: 'vehicle_documents_vehicle_id_fkey'; columns: ['vehicle_id']; isOneToOne: false; referencedRelation: 'vehicles'; referencedColumns: ['id'] },
        ];
      };
      vehicle_expenses: {
        Row: {
          id: string;
          vehicle_id: string;
          category: string;
          description: string | null;
          amount: number;
          date: string;
          invoice_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          vehicle_id: string;
          category: string;
          description?: string | null;
          amount: number;
          date: string;
          invoice_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          vehicle_id?: string;
          category?: string;
          description?: string | null;
          amount?: number;
          date?: string;
          invoice_url?: string | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: 'vehicle_expenses_vehicle_id_fkey'; columns: ['vehicle_id']; isOneToOne: false; referencedRelation: 'vehicles'; referencedColumns: ['id'] },
        ];
      };
      vehicle_history: {
        Row: {
          id: string;
          vehicle_id: string;
          action: string;
          description: string | null;
          date: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          vehicle_id: string;
          action: string;
          description?: string | null;
          date?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          vehicle_id?: string;
          action?: string;
          description?: string | null;
          date?: string;
          created_by?: string | null;
        };
        Relationships: [
          { foreignKeyName: 'vehicle_history_vehicle_id_fkey'; columns: ['vehicle_id']; isOneToOne: false; referencedRelation: 'vehicles'; referencedColumns: ['id'] },
          { foreignKeyName: 'vehicle_history_created_by_fkey'; columns: ['created_by']; isOneToOne: false; referencedRelation: 'users'; referencedColumns: ['id'] },
        ];
      };
      vehicle_listings: {
        Row: {
          id: string;
          vehicle_id: string;
          platform: string;
          url: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          vehicle_id: string;
          platform: string;
          url: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          vehicle_id?: string;
          platform?: string;
          url?: string;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: 'vehicle_listings_vehicle_id_fkey'; columns: ['vehicle_id']; isOneToOne: false; referencedRelation: 'vehicles'; referencedColumns: ['id'] },
        ];
      };
      app_settings: {
        Row: {
          id: string;
          expense_categories: string[];
          document_types: string[];
          updated_at: string;
        };
        Insert: {
          id?: string;
          expense_categories?: string[];
          document_types?: string[];
          updated_at?: string;
        };
        Update: {
          id?: string;
          expense_categories?: string[];
          document_types?: string[];
          updated_at?: string;
        };
        Relationships: [];
      };
      vehicle_valuations: {
        Row: {
          id: string;
          vehicle_id: string;
          median_price: number;
          min_price: number;
          max_price: number;
          avg_price: number;
          p25: number;
          p75: number;
          total_ads: number;
          total_excluded: number;
          search_params: Record<string, unknown>;
          geo_lat: number | null;
          geo_lng: number | null;
          geo_radius_km: number | null;
          geo_label: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          vehicle_id: string;
          median_price: number;
          min_price: number;
          max_price: number;
          avg_price: number;
          p25: number;
          p75: number;
          total_ads: number;
          total_excluded: number;
          search_params: Record<string, unknown>;
          geo_lat?: number | null;
          geo_lng?: number | null;
          geo_radius_km?: number | null;
          geo_label?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          vehicle_id?: string;
          median_price?: number;
          min_price?: number;
          max_price?: number;
          avg_price?: number;
          p25?: number;
          p75?: number;
          total_ads?: number;
          total_excluded?: number;
          search_params?: Record<string, unknown>;
          geo_lat?: number | null;
          geo_lng?: number | null;
          geo_radius_km?: number | null;
          geo_label?: string | null;
        };
        Relationships: [
          { foreignKeyName: 'vehicle_valuations_vehicle_id_fkey'; columns: ['vehicle_id']; isOneToOne: false; referencedRelation: 'vehicles'; referencedColumns: ['id'] },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

// =============================================================
// Aliases pratiques pour utilisation dans le code
// =============================================================

type Tables = Database['public']['Tables'];

export type Vehicle = Tables['vehicles']['Row'];
export type VehicleInsert = Tables['vehicles']['Insert'];
export type VehicleUpdate = Tables['vehicles']['Update'];

export type VehiclePhoto = Tables['vehicle_photos']['Row'];
export type VehiclePhotoInsert = Tables['vehicle_photos']['Insert'];
export type VehiclePhotoUpdate = Tables['vehicle_photos']['Update'];

export type VehicleDocument = Tables['vehicle_documents']['Row'];
export type VehicleDocumentInsert = Tables['vehicle_documents']['Insert'];
export type VehicleDocumentUpdate = Tables['vehicle_documents']['Update'];

export type VehicleExpense = Tables['vehicle_expenses']['Row'];
export type VehicleExpenseInsert = Tables['vehicle_expenses']['Insert'];
export type VehicleExpenseUpdate = Tables['vehicle_expenses']['Update'];

export type VehicleHistory = Tables['vehicle_history']['Row'];
export type VehicleHistoryInsert = Tables['vehicle_history']['Insert'];
export type VehicleHistoryUpdate = Tables['vehicle_history']['Update'];

export type VehicleListing = Tables['vehicle_listings']['Row'];
export type VehicleListingInsert = Tables['vehicle_listings']['Insert'];

export type AppSettings = Tables['app_settings']['Row'];
export type AppSettingsUpdate = Tables['app_settings']['Update'];

export type VehicleValuation = Tables['vehicle_valuations']['Row'];
export type VehicleValuationInsert = Tables['vehicle_valuations']['Insert'];
