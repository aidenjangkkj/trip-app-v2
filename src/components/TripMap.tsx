"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl, { Map, GeoJSONSource, LngLatLike } from "mapbox-gl";
import type { TripItem } from "@/types/trip";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

type Props = {
  items: TripItem[]; // Day 내 아이템들
  onSelect?: (id: string) => void; // 마커/아이콘 클릭 시
  selectedId?: string | null; // 선택 하이라이트
  mode?: "walk" | "transit" | "car";
  clustered?: boolean; // ✅ 클러스터 on/off (데모 땐 false 권장)
};

export default function TripMap({
  items,
  onSelect,
  selectedId,
  mode = "walk",
  clustered = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const [ready, setReady] = useState(false);

  // 포인트(아이콘 매핑 위해 category 포함)
  const points = useMemo(() => {
    const features = items
      .filter(
        (it) =>
          typeof it.place.lat === "number" && typeof it.place.lng === "number"
      )
      .map((it) => ({
        type: "Feature" as const,
        properties: {
          id: it.id ?? "",
          name: it.place.name,
          category: it.place.category || "marker",
        },
        geometry: {
          type: "Point" as const,
          coordinates: [it.place.lng!, it.place.lat!],
        },
      }));
    return { type: "FeatureCollection" as const, features };
  }, [items]);

  // 동선 라인
  const line = useMemo(() => {
    const coords = items
      .filter(
        (it) =>
          typeof it.place.lat === "number" && typeof it.place.lng === "number"
      )
      .map((it) => [it.place.lng!, it.place.lat!]);
    if (coords.length < 2)
      return { type: "FeatureCollection" as const, features: [] as any[] };
    return {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          properties: {},
          geometry: { type: "LineString" as const, coordinates: coords },
        },
      ],
    };
  }, [items]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // ✅ 컨테이너를 깨끗이 비우고 시작 (경고 방지)
    try {
      containerRef.current.replaceChildren(); // 또는: containerRef.current.innerHTML = "";
    } catch {}

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [139.767, 35.681], // 초기(도쿄역)
      zoom: 11,
      cooperativeGestures: true,
    });
    mapRef.current = map;

    map.addControl(
      new mapboxgl.NavigationControl({ visualizePitch: true }),
      "top-right"
    );

    map.on("load", () => {
      // ✅ 누락 아이콘 fallback (sprite 미존재 대비)
      map.on("styleimagemissing", (e) => {
        const id = e.id;
        if (!map.hasImage(id)) {
          map.loadImage(
            "https://docs.mapbox.com/mapbox-gl-js/assets/custom_marker.png",
            (error, image) => {
              if (error || !image) return;
              if (!map.hasImage(id)) map.addImage(id, image);
            }
          );
        }
      });

      // ✅ 이하 기존 소스/레이어/이벤트 등록 그대로...
      map.addSource("plan-points", {
        type: "geojson",
        data: points,
        ...(clustered
          ? { cluster: true, clusterMaxZoom: 12, clusterRadius: 40 }
          : {}),
      });

      if (clustered) {
        map.addLayer({
          id: "clusters",
          type: "circle",
          source: "plan-points",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "#2563eb",
            "circle-radius": [
              "step",
              ["get", "point_count"],
              15,
              10,
              20,
              25,
              30,
            ],
            "circle-opacity": 0.7,
          },
        });
        map.addLayer({
          id: "cluster-count",
          type: "symbol",
          source: "plan-points",
          filter: ["has", "point_count"],
          layout: {
            "text-field": ["get", "point_count_abbreviated"],
            "text-size": 12,
          },
          paint: { "text-color": "#fff" },
        });
      }

      map.addLayer({
        id: "unclustered-circle",
        type: "circle",
        source: "plan-points",
        ...(clustered ? { filter: ["!", ["has", "point_count"]] } : {}),
        paint: {
          "circle-color": [
            "case",
            ["==", ["get", "id"], selectedId ?? ""],
            "#ef4444",
            "#10b981",
          ],
          "circle-radius": 6,
          "circle-stroke-width": 1.2,
          "circle-stroke-color": "#fff",
        },
      });

      map.addLayer({
        id: "unclustered-symbol",
        type: "symbol",
        source: "plan-points",
        ...(clustered ? { filter: ["!", ["has", "point_count"]] } : {}),
        layout: {
          "icon-image": [
            "match",
            ["get", "category"],
            "food",
            "restaurant-15",
            "cafe",
            "cafe-15",
            "shop",
            "shop-15",
            "sight",
            "monument-15",
            "activity",
            "attraction-15",
            "transport",
            "bus-15",
            "hotel",
            "lodging-15",
            /* default */ "marker-15",
          ],
          "icon-size": 1.2,
          "icon-allow-overlap": false,
          "text-allow-overlap": false,
          "text-field": ["get", "name"],
          "text-size": 11,
          "text-offset": [0, 1.2],
          "text-anchor": "top",
          "text-optional": true,
        },
        paint: { "text-color": "#111827" },
      });

      map.addSource("route-line", { type: "geojson", data: line });
      map.addLayer(
        {
          id: "route",
          type: "line",
          source: "route-line",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#111827",
            "line-width": 3,
            "line-opacity": 0.8,
          },
        },
        "unclustered-symbol"
      );

      if (clustered) {
        map.on("click", "clusters", (e) => {
          const features = map.queryRenderedFeatures(e.point, {
            layers: ["clusters"],
          });
          const center = (features[0].geometry as any)
            .coordinates as LngLatLike;
          const clusterId = features[0].properties?.cluster_id;
          const src = map.getSource("plan-points") as GeoJSONSource;
          src.getClusterExpansionZoom(clusterId, (err, z) => {
            if (err) return;
            const nextZoom = typeof z === "number" ? Math.max(14, z) : 14;
            map.easeTo({ center, zoom: nextZoom });
          });
        });
      }

      const selectFromEvent = (e: any) => {
        const f = e.features?.[0];
        const id = f?.properties && (f.properties as any).id;
        if (id && onSelect) onSelect(id);
      };
      map.on("click", "unclustered-symbol", selectFromEvent);
      map.on("click", "unclustered-circle", selectFromEvent);

      const hoverLayers = [
        ...(clustered ? ["clusters", "cluster-count"] : []),
        "unclustered-symbol",
        "unclustered-circle",
      ];
      hoverLayers.forEach((layerId) => {
        if (!map.getLayer(layerId)) return;
        map.on(
          "mouseenter",
          layerId,
          () => (map.getCanvas().style.cursor = "pointer")
        );
        map.on(
          "mouseleave",
          layerId,
          () => (map.getCanvas().style.cursor = "")
        );
      });

      setReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [clustered]);
  // clustered 변경 시 재생성

  // 데이터/선택 변경 시 업데이트 + bounds/zoom 보정
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;

    const src = map.getSource("plan-points") as GeoJSONSource | undefined;
    if (src) src.setData(points as any);

    const lineSrc = map.getSource("route-line") as GeoJSONSource | undefined;
    if (lineSrc) lineSrc.setData(line as any);

    // 선택 하이라이트 컬러 반영
    if (map.getLayer("unclustered-circle")) {
      map.setPaintProperty("unclustered-circle", "circle-color", [
        "case",
        ["==", ["get", "id"], selectedId ?? ""],
        "#ef4444",
        "#10b981",
      ]);
    }

    // bounds fit
    const coords = (points.features as any[]).map(
      (f) => f.geometry.coordinates
    );
    if (coords.length) {
      const b = new mapboxgl.LngLatBounds();
      coords.forEach((c) => b.extend(c as [number, number]));
      map.fitBounds(b, {
        padding: 60,
        maxZoom: clustered ? 15 : 16, // 데모에서 아이콘 바로 보이게
        duration: 400,
      });
      const z = map.getZoom();
      const minZoom = clustered ? 14.5 : 16;
      if (z < minZoom) map.easeTo({ zoom: minZoom, duration: 200 });
    }
  }, [points, line, ready, clustered]);
  useEffect(() => {
    if (!ready || !mapRef.current || !selectedId) return;
    const map = mapRef.current;
    const it = items.find((i) => i.id === selectedId);
    const lng = it?.place.lng;
    const lat = it?.place.lat;
    if (typeof lng === "number" && typeof lat === "number") {
      const targetZoom = Math.max(map.getZoom(), clustered ? 16 : 15); // 클러스터면 더 확대
      map.easeTo({
        center: [lng, lat], // ✅ [lng, lat] 순서
        zoom: targetZoom,
        duration: 600,
        essential: true,
      });
    }
  }, [selectedId, ready, clustered, items]);

  return (
    <div
      ref={containerRef}
      className="w-full h-[420px] rounded-2xl overflow-hidden border"
    />
  );
}
